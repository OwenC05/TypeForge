"""Build the English v2 banks offline. Run with Python 3.14 from any directory."""

import bz2
from collections import Counter, defaultdict
from fractions import Fraction
from functools import cache
import gzip
import hashlib
import json
from pathlib import Path
import random
import re
from string import ascii_lowercase


HERE = Path(__file__).resolve().parent
CACHE = HERE / ".cache"
CLIENT = HERE.parents[1] / "typing-app/client/src"
OUTPUT = CLIENT / "generated"
SOURCE_URL = "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences_CC0.tsv.bz2"
SOURCE_SHA256 = "c2e2edd063a31cbbc8e416a4858225e934bbb0afff485031821e59f230ccf1ca"
SOURCE_BYTES = 1_288_689
FREQUENCIES_SHA256 = "73053fe706308e95a04052ba8fe19dfaecb00079104f46af9cd2b6a31c9d1327"
SEED = 20261124
ASSESSMENT_SIZE = 600
MAX_PASSAGE_LENGTH = 49
# The 49-character pool leaves only 1,415 characters for ec and 1,430 for ie.
# These are the shortest extra sentences for their respective 3 × 480-character plans.
PRACTICE_EXCEPTIONS = {9935723: "ec", 12764794: "ie"}
PLAN_COUNT = 3
MIN_DENSE = 16
PINNED_INPUTS = {
    "corpus.ts": "06b1be5965d501300f05ecdad0555406c30dbe4c5608c4830c7eedf055e76964",
    "coach-config.json": "7f946e2c880693c8c107da6cdfac882b9367438a50a6a2469b7f29f81047d3c6",
}

US_SPELLINGS = """
airplane* aluminum analyz* behavior* center centers centered centering centimeter*
color colors colored coloring colorful cozy defense* donut* enroll enrollment
favorite* favor favors favored favoring flavor* gray grays grayish harbor*
honor honors honored honoring humor jewelry kilometer* labor labors labored
laboring laborer* liter liters maneuver* math mom moms mustache* neighbor* odor*
offense* organiz* pajama* paralyz* parlor* prioritiz* personaliz* recogniz*
maximiz* minimiz* realiz* sidewalk* skeptic* specializ* theater* traveled
traveler* traveling valor* vapor* vigor*
"""


def word_pattern(entries):
    patterns = []
    for line in entries.splitlines():
        for word in line.partition("#")[0].split():
            stem = re.escape(word.removesuffix("*"))
            patterns.append(stem + ("[a-z]*" if word.endswith("*") else ""))
    return re.compile(r"\b(?:" + "|".join(patterns) + r")\b")


def source_rows():
    path = CACHE / SOURCE_URL.rsplit("/", 1)[1]
    if not path.is_file():
        raise SystemExit(f"Place the pinned English CC0 export in {path} (see REPORT.md).")
    raw = path.read_bytes()
    if len(raw) != SOURCE_BYTES or hashlib.sha256(raw).hexdigest() != SOURCE_SHA256:
        raise SystemExit("English CC0 export differs from the pin. Restore the 2026-11-21 cached file.")
    rows = {}
    for line in bz2.decompress(raw).decode("utf-8").splitlines():
        source_id, lang, text, _ = line.split("\t")
        key = int(source_id)
        if lang != "eng" or key in rows:
            raise ValueError(f"Invalid English source row {source_id}")
        rows[key] = text
    return rows


def pinned_input(name):
    # Keep the v1 exclusions and policy reproducible after the app adopts v2.
    for path in (CLIENT / name, CACHE / name):
        if path.is_file():
            content = path.read_text(encoding="utf-8").encode("utf-8")
            if hashlib.sha256(content).hexdigest() == PINNED_INPUTS[name]:
                if path.parent == CLIENT:
                    (CACHE / name).write_bytes(content)
                return content.decode("utf-8")
    raise ValueError(f"Restore {name} from the A3 base revision in .cache (see REPORT.md).")


class NearDuplicates:
    def __init__(self):
        self.whole = set()
        self.shortened = set()
        self.orders = set()
        self.postings = defaultdict(list)
        self.sizes = []

    def add(self, text, *, original=False):
        words = tuple(text.split())
        order = tuple(sorted(words))
        elisions = {words[:i] + words[i + 1:] for i in range(len(words))}
        grams = {text[i:i + 3] for i in range(len(text) - 2)}
        if not original:
            if (words in self.shortened or order in self.orders or
                    self.whole.intersection(elisions) or self.shortened.intersection(elisions)):
                return False
            # At least 85% Dice similarity on character trigrams, including spaces.
            overlap = Counter(index for gram in grams for index in self.postings[gram])
            if any(40 * n >= 17 * (len(grams) + self.sizes[i]) for i, n in overlap.items()):
                return False
        for gram in grams:
            self.postings[gram].append(len(self.sizes))
        self.sizes.append(len(grams))
        self.whole.add(words)
        self.orders.add(order)
        self.shortened.update(elisions)
        return True


def filtered_pool(rows, originals):
    terms = Counter(re.findall("[a-z]+", "\n".join(rows.values()).lower()))
    vocabulary = set(sorted(terms, key=lambda w: (-terms[w], w))[:20_000])
    blocked = word_pattern((HERE / "blocklist.txt").read_text(encoding="utf-8"))
    american = word_pattern(US_SPELLINGS)
    reviewed = {int(word) for line in (HERE / "everyday-ids.txt").read_text().splitlines()
                for word in line.partition("#")[0].split()}
    rejected = Counter()
    kept = {}
    originals = set(originals)
    seen = set()
    near = NearDuplicates()
    for text in sorted(originals):
        near.add(text, original=True)
    for key, raw in sorted(rows.items()):
        # A single terminal sentence mark is a boundary. All interior characters
        # and spaces must already fit; never repair a contraction or punctuation.
        match = re.fullmatch(r"([A-Za-z]+(?: [A-Za-z]+)+)[.?!]?", raw)
        if not match:
            rejected["alphabet, punctuation or spacing"] += 1
            continue
        surface = match[1]
        text = surface.lower()
        words = tuple(text.split())
        if not 30 <= len(text) <= 70:
            rejected["length outside 30–70"] += 1
        elif not all(w.islower() for w in surface.split()[1:]):
            rejected["non-initial capital"] += 1
        elif blocked.search(text):
            rejected["excluded topic or tone"] += 1
        elif 100 * sum(w in vocabulary for w in words) < 95 * len(words):
            rejected["common vocabulary below 95%"] += 1
        elif american.search(text):
            rejected["house spelling"] += 1
        elif key not in reviewed:
            rejected["outside reviewed everyday selection"] += 1
        elif text in originals:
            rejected["exact v1 overlap"] += 1
        elif text in seen:
            rejected["exact duplicate"] += 1
        elif not near.add(text):
            rejected["near duplicate (including v1)"] += 1
        else:
            kept[key] = text
            seen.add(text)
    return kept, rejected


def pair_counts(texts):
    counts = Counter()
    characters = 0
    for text in texts:
        characters += len(text)
        for word in text.split():
            counts.update(word[i:i + 2] for i in range(len(word) - 1))
    return counts, characters


def candidate_pairs(counts):
    result = []
    covered = 0
    for pair in sorted(counts, key=lambda p: (-counts[p], p))[:100]:
        result.append(pair)
        covered += counts[pair]
        if covered * 10 >= counts.total() * 9:
            break
    return result


@cache
def occurrences(text, pair):
    """One-based pair and word end offsets, identical to coach-plan.ts."""
    found = []
    start = 0
    for word in text.split():
        pos = word.find(pair)
        while pos != -1:
            found.append((start + pos + 2, start + len(word), word))
            pos = word.find(pair, pos + 1)
        start += len(word) + 1
    return found


def prefix_passes(ends, start, stop, prior_hits, rate, first_prefix):
    # Between hits the largest prefix is the hardest to pass. Check immediately
    # before each hit and at the end, including the first eligible prefix.
    for end in ends:
        n = start + end - 1
        if n >= first_prefix and prior_hits * rate.denominator < n * rate.numerator:
            return False
        prior_hits += 1
    return stop < first_prefix or prior_hits * rate.denominator >= stop * rate.numerator


def find_plans(pair, order, texts, rate, rules):
    used = set()
    plans = []
    for _ in range(PLAN_COUNT):
        plan = []
        words = set()
        chars = hits = passages = 0
        while chars < rules["minimumPlanCharacters"]:
            for key in order:
                if key in used:
                    continue
                text = texts[key]
                stop = chars + len(text)
                events = occurrences(text, pair)
                if stop > rules["maximumPlanCharacters"] or (
                    not plan and events[0][0] > rules["firstTargetByCharacter"]
                ):
                    continue
                early = {w for _, end, w in events if chars + end <= rules["wordsByCharacter"]}
                if len(words) < rules["minimumWords"] and not early.difference(words):
                    continue
                if not prefix_passes((e for e, _, _ in events), chars, stop, hits, rate,
                                     rules["allPrefixesFrom"]):
                    continue
                plan.append(key)
                used.add(key)
                words.update(early)
                chars = stop
                passages += chars <= rules["passagesByCharacter"]
                hits += len(events)
                break
            else:
                return plans
        if len(words) < rules["minimumWords"] or passages < rules["minimumPassages"]:
            return plans
        plans.append(plan)
    return plans


def practice_bank(pool, assessment, candidates, rules):
    choices = {p: [] for p in candidates}
    assessed, assessment_chars = pair_counts(assessment.values())
    for key, text in pool.items():
        if key in assessment:
            continue
        counts, length = pair_counts([text])
        for pair, n in counts.items():
            if key in PRACTICE_EXCEPTIONS and PRACTICE_EXCEPTIONS[key] != pair:
                continue
            if pair in choices and n * assessment_chars >= 2 * assessed[pair] * length:
                choices[pair].append(key)

    # Prefer longer prompts that contribute to several thinly supported pairs.
    utility = Counter()
    for eligible in choices.values():
        for key in eligible:
            utility[key] += len(pool) // len(eligible)
    scarce_first = sorted(choices, key=lambda p: (len(choices[p]), p))
    for eligible in choices.values():
        eligible.sort(key=lambda k: (-utility[k] * len(pool[k]), k))
    ratio = Fraction(str(rules["minimumRatio"]))
    minimum = max(MIN_DENSE, rules["minimumBankPassages"])

    def fit(bank, *, stop_on_gap):
        general, chars = pair_counts(pool[k] for k in bank)
        result = {}
        for pair in scarce_first:
            eligible = [k for k in choices[pair] if k in bank]
            rate = ratio * Fraction(general[pair], chars)
            plans = find_plans(pair, eligible, pool, rate, rules)
            # Near the three-plan character floor a greedy ordering can spend too much on
            # the first two plans. Try other fixed orders before needing longer text.
            if (len(plans) < PLAN_COUNT and pair in PRACTICE_EXCEPTIONS.values()
                    and sum(len(pool[k]) for k in eligible) >= PLAN_COUNT * rules["minimumPlanCharacters"]):
                random_order = random.Random(SEED)
                for _ in range(16):
                    plans = find_plans(pair, random_order.sample(eligible, len(eligible)), pool, rate, rules)
                    if len(plans) == PLAN_COUNT:
                        break
            if stop_on_gap and (len(eligible) < minimum or len(plans) < PLAN_COUNT):
                return None
            result[pair] = plans
        return result

    bank = set(utility)
    witnesses = fit(bank, stop_on_gap=False)
    if all(len(plans) == PLAN_COUNT for plans in witnesses.values()):
        # Try the least used passages first. Each deletion rechecks all targets
        # because it changes the complete General bank's density for every pair.
        while True:
            before = len(bank)
            uses = Counter(k for plans in witnesses.values() for plan in plans for k in plan)
            for key in sorted(bank, key=lambda k: (uses[k], utility[k], k)):
                trial = bank - {key}
                updated = fit(trial, stop_on_gap=True)
                if updated is not None:
                    bank, witnesses = trial, updated
            if len(bank) == before:
                break
    dense = {p: len(bank.intersection(options)) for p, options in choices.items()}
    return {k: pool[k] for k in sorted(bank)}, witnesses, dense


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=True, indent=2) + "\n").encode("ascii")


def write_bank(kind, bank):
    prompts = [{"id": f"tatoeba-{k}", "text": text} for k, text in sorted(bank.items())]
    data = {"version": "2", "source": SOURCE_URL, "licence": "CC0-1.0", "sha256": SOURCE_SHA256, "sentences": prompts}
    if kind == "practice":
        data["pairOnly"] = {f"tatoeba-{k}": pair for k, pair in PRACTICE_EXCEPTIONS.items() if k in bank}
    raw = json_bytes(data)
    path = OUTPUT / f"{kind}-bank-v2.json"
    path.write_bytes(raw)
    print(f"{path.name}: {len(bank)} sentences, {len(raw)} bytes, "
          f"{len(gzip.compress(raw, compresslevel=9, mtime=0))} gzip, {hashlib.sha256(raw).hexdigest()}")


def main():
    rows = source_rows()
    originals = re.findall(r"text: '([a-z ]+)'", pinned_input("corpus.ts"))
    rules = json.loads(pinned_input("coach-config.json"))["exposure"]
    pool, rejected = filtered_pool(rows, originals)
    # Only display selection has a length cap. The registered frequencies use the full pool.
    selectable = {k: text for k, text in pool.items() if len(text) <= MAX_PASSAGE_LENGTH}
    assessment = {k: selectable[k] for k in random.Random(SEED).sample(sorted(selectable), ASSESSMENT_SIZE)}
    counts, chars = pair_counts(pool.values())
    candidates = candidate_pairs(counts)
    practice_pool = {**selectable, **{k: pool[k] for k in PRACTICE_EXCEPTIONS}}
    practice, plans, dense = practice_bank(practice_pool, assessment, candidates, rules)
    gaps = [p for p in candidates if len(plans[p]) != PLAN_COUNT or dense[p] < max(MIN_DENSE, rules["minimumBankPassages"])]
    if gaps:
        raise ValueError(f"Insufficient dense passages or disjoint plans for: {', '.join(gaps)}")
    frequencies = {
        "source": SOURCE_URL, "source_sha256": SOURCE_SHA256,
        "population": "full filtered English CC0 pool before sampling",
        "sentences": len(pool), "characters_including_spaces": chars,
        "within_word_pair_occurrences": counts.total(), "candidate_pairs": candidates,
        "pairs": {a + b: {"count": counts[a + b], "per_character": counts[a + b] / chars}
                  for a in ascii_lowercase for b in ascii_lowercase},
    }
    raw_frequencies = json_bytes(frequencies)
    if hashlib.sha256(raw_frequencies).hexdigest() != FREQUENCIES_SHA256:
        raise ValueError("Pair frequencies differ from the fresh-test registration.")
    (HERE / "pair_frequencies.json").write_bytes(raw_frequencies)
    (OUTPUT / "manual-pairs-v2.json").write_bytes(json_bytes(candidates))
    write_bank("assessment", assessment)
    write_bank("practice", practice)
    # Small, recoverable witnesses for the coordinator and subsequent integration.
    (CACHE / "plan-witnesses.json").write_bytes(json_bytes({
        p: [[f"tatoeba-{k}" for k in plan] for plan in sequences] for p, sequences in plans.items()
    }))
    print("Source:", len(rows), "rejected by first matching filter:", dict(rejected), "pool:", len(pool))
    print("Dense sentences / disjoint plans:",
          " ".join(f"{p}={dense[p]}/{len(plans[p])}" for p in candidates))


if __name__ == "__main__":
    main()
