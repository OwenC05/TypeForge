"""Audit the shipped banks and the ordered witnesses from an offline build."""

from collections import Counter
from fractions import Fraction
import json
from pathlib import Path
import random
import re
from string import ascii_lowercase
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import build_banks as b


def read(path):
    return json.loads(path.read_bytes())


def independent_counts(texts):
    return Counter(p for text in texts for p in re.findall(r"(?=([a-z]{2}))", text))


class CommittedBankTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.assessment = read(b.OUTPUT / "assessment-bank-v2.json")["sentences"]
        cls.practice = read(b.OUTPUT / "practice-bank-v2.json")["sentences"]
        cls.frequencies = read(b.HERE / "pair_frequencies.json")

    def test_counts_lengths_and_disjoint_banks(self):
        old = re.findall(r"id: '([^']+)', text: '([a-z ]+)'", (b.CLIENT / "corpus.ts").read_text(encoding="utf-8"))
        self.assertEqual(len(old), 120)
        ids = {key for key, _ in old}
        used = {text for _, text in old}
        self.assertEqual((len(self.assessment), len(self.practice)), (600, 292))
        for prompt in self.practice + self.assessment:
            key, text = prompt["id"], prompt["text"]
            self.assertRegex(key, r"^tatoeba-[1-9][0-9]*$")
            self.assertRegex(text, r"^[a-z]+(?: [a-z]+)+$")
            self.assertTrue(30 <= len(text) <= 68, key)
            self.assertNotIn(text, used)
            self.assertNotIn(key, ids)
            used.add(text)
            ids.add(key)
        for kind in ("practice", "assessment"):
            bank = read(b.OUTPUT / f"{kind}-bank-v2.json")
            self.assertEqual((bank["version"], bank["source"], bank["licence"], bank["sha256"]),
                             ("2", b.SOURCE_URL, "CC0-1.0", b.SOURCE_SHA256))

    def test_all_100_picker_pairs_have_dense_passages(self):
        ranked = sorted(self.frequencies["pairs"], key=lambda pair: (-self.frequencies["pairs"][pair]["count"], pair))
        candidates = self.frequencies["candidate_pairs"]
        self.assertEqual(candidates, ranked[:100])
        self.assertEqual(read(b.OUTPUT / "manual-pairs-v2.json"), candidates)
        chars = sum(len(prompt["text"]) for prompt in self.assessment)
        assessed = independent_counts(prompt["text"] for prompt in self.assessment)
        practice = [(len(p["text"]), independent_counts([p["text"]])) for p in self.practice]
        for pair in candidates:
            dense = sum(hits[pair] > 0 and hits[pair] * chars >= 2 * assessed[pair] * length
                        for length, hits in practice)
            self.assertGreaterEqual(dense, b.MIN_DENSE, pair)


SOURCE_EXPORT = b.CACHE / b.SOURCE_URL.rsplit("/", 1)[1]


@unittest.skipUnless(SOURCE_EXPORT.is_file(), "pinned CC0 source export is not cached")
class SourceBankTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            cls.source = b.source_rows()
        except SystemExit as error:
            raise AssertionError(str(error)) from error
        cls.old = re.findall(r"text: '([a-z ]+)'", b.pinned_input("corpus.ts"))
        cls.pool, _ = b.filtered_pool(cls.source, cls.old)
        cls.assessment = read(b.OUTPUT / "assessment-bank-v2.json")["sentences"]

    def test_source_identity(self):
        practice = read(b.OUTPUT / "practice-bank-v2.json")["sentences"]
        for prompt in self.assessment + practice:
            source_id = int(prompt["id"].removeprefix("tatoeba-"))
            source = self.source[source_id]
            self.assertEqual(source.rstrip(".?!").lower(), prompt["text"])
            self.assertTrue(all(w.islower() for w in source.split()[1:]))

    def test_uniform_assessment_precedes_pair_selection(self):
        draw = random.Random(20261124).sample(sorted(self.pool), 600)
        self.assertCountEqual([p["id"] for p in self.assessment], [f"tatoeba-{k}" for k in draw])

    def test_pins_reject_changed_source_and_recover_old_app_inputs(self):
        with TemporaryDirectory(dir=b.CACHE) as temp:
            filename = b.SOURCE_URL.rsplit("/", 1)[1]
            data = bytearray((b.CACHE / filename).read_bytes())
            data[-1] ^= 1
            (Path(temp) / filename).write_bytes(data)
            with patch.object(b, "CACHE", Path(temp)):
                with self.assertRaisesRegex(SystemExit, "differs from the pin"):
                    b.source_rows()
            for name in b.PINNED_INPUTS:
                expected = b.pinned_input(name)
                with patch.object(b, "CLIENT", Path(temp)):
                    self.assertEqual(b.pinned_input(name), expected)

    def test_no_lexical_neighbours_in_pool_or_v1(self):
        prior_grams = []
        orders, complete, deleted_one = set(), set(), set()
        for index, text in enumerate([*self.old, *self.pool.values()]):
            words = tuple(text.split())
            order = tuple(sorted(words))
            short = {words[:i] + words[i + 1:] for i in range(len(words))}
            grams = set(zip(text, text[1:], text[2:]))
            if index >= len(self.old):
                self.assertNotIn(order, orders, text)
                self.assertNotIn(words, deleted_one, text)
                self.assertTrue(short.isdisjoint(complete) and short.isdisjoint(deleted_one), text)
                for old in prior_grams:
                    self.assertLess(200 * len(grams & old), 85 * (len(grams) + len(old)), text)
            orders.add(order)
            complete.add(words)
            deleted_one.update(short)
            prior_grams.append(grams)

    def test_all_pair_frequencies_and_candidate_cutoff(self):
        f = read(b.HERE / "pair_frequencies.json")
        counts = independent_counts(self.pool.values())
        chars = sum(len(t) for t in self.pool.values())
        self.assertEqual(f["source_sha256"], b.SOURCE_SHA256)
        self.assertEqual((f["sentences"], f["characters_including_spaces"], f["within_word_pair_occurrences"]),
                         (len(self.pool), chars, counts.total()))
        self.assertEqual(set(f["pairs"]), {a + z for a in ascii_lowercase for z in ascii_lowercase})
        for pair, entry in f["pairs"].items():
            self.assertEqual(entry, {"count": counts[pair], "per_character": counts[pair] / chars})
        ranked = sorted(counts, key=lambda p: (-counts[p], p))
        cutoff = next(i for i in range(1, len(ranked) + 1)
                      if sum(counts[p] for p in ranked[:i]) * 10 >= counts.total() * 9)
        self.assertEqual(f["candidate_pairs"], ranked[:min(100, cutoff)])


class WitnessTests(unittest.TestCase):
    @unittest.skipUnless((b.CACHE / "plan-witnesses.json").is_file(), "offline plan witnesses are not cached")
    def test_every_dense_sentence_and_plan_prefix(self):
        rules = json.loads(b.pinned_input("coach-config.json"))["exposure"]
        plans = read(b.CACHE / "plan-witnesses.json")
        self.assertEqual(set(plans), set(read(b.HERE / "pair_frequencies.json")["candidate_pairs"]))
        general = {p["id"]: p["text"] for p in read(b.OUTPUT / "practice-bank-v2.json")["sentences"]}
        g_chars = sum(map(len, general.values()))
        assessment = read(b.OUTPUT / "assessment-bank-v2.json")["sentences"]
        a_chars = sum(len(p["text"]) for p in assessment)
        assessed = independent_counts(p["text"] for p in assessment)
        opportunities = independent_counts(general.values())
        counts = {k: independent_counts([text]) for k, text in general.items()}
        ratio = Fraction(str(rules["minimumRatio"]))
        for pair, sequences in plans.items():
            dense = {k for k, text in general.items() if counts[k][pair] > 0 and
                     counts[k][pair] * a_chars >= 2 * assessed[pair] * len(text)}
            self.assertGreaterEqual(len(dense), max(16, rules["minimumBankPassages"]), pair)
            self.assertEqual(len(sequences), 3, pair)
            used = set()
            for sequence in sequences:
                ends, early_words = set(), set()
                chars = passages = 0
                for key in sequence:
                    self.assertNotIn(key, used, pair)
                    self.assertIn(key, dense, pair)
                    used.add(key)
                    for word in re.finditer("[a-z]+", general[key]):
                        for hit in re.finditer(f"(?={pair})", word[0]):
                            ends.add(chars + word.start() + hit.start() + 2)
                            if chars + word.end() <= rules["wordsByCharacter"]:
                                early_words.add(word[0])
                    chars += len(general[key])
                    passages += chars <= rules["passagesByCharacter"]
                self.assertTrue(rules["minimumPlanCharacters"] <= chars <= rules["maximumPlanCharacters"])
                self.assertLessEqual(min(ends), rules["firstTargetByCharacter"], pair)
                self.assertGreaterEqual(len(early_words), rules["minimumWords"], pair)
                self.assertGreaterEqual(passages, rules["minimumPassages"], pair)
                seen = 0
                for n in range(1, chars + 1):
                    seen += n in ends
                    if n >= rules["allPrefixesFrom"]:
                        self.assertGreaterEqual(seen * g_chars * ratio.denominator,
                                                n * opportunities[pair] * ratio.numerator, (pair, n))


if __name__ == "__main__":
    unittest.main()
