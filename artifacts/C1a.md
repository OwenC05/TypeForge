# C1a browser coach

Branch `OwenC05/tf-coach-browser`. Final implementation and tests `744eab495134bf57aeeb1816dff6a08525191f88`.
The handoff adds this report in the next commit (`git log -1 --format=%H OwenC05/tf-coach-browser -- artifacts/C1a.md`).

The L5 table is 52,510 bytes. Two exports from the registered train split produced identical bytes.
Table SHA256 `10154cf4714fa0b32129c97a9f7b87987f517d1d6e2099f7863f2cb2dfef29c7`.
Fitted SHA256 `c813005bd99f23fc88b9370490eb8dffa1792c57d5151d23b07047477fe85158`.
The table records the verified train and Git-LF corpus hashes. All 676 pairs have coefficients and 100 have positive frequency.

All 20 synthetic histories reproduced the Python decision (6 suggestions, 14 abstentions). Both runtimes tied exactly on `an` and `at` and selected `an`.
All 98 directly recorded pair posteriors and 80% ranges matched within absolute `1e-9`. Tests checked the remaining unobserved pairs against the fitted prior at Python's speed.
The synthetic 190 and 20 WPM histories cross opposite support endpoints. WPM only sets the synthetic inter-key pace.

## A2 replay

Of 32 fixtures, 23 matched eligibility, counts and log sums (27 retained intervals). Seven cannot produce a comparable engine summary. Two disagree.

| Fixtures outside the engine interface | Reason |
| --- | --- |
| `uppercase-punctuation-and-code-point-offsets`, `straight-and-curly-apostrophes`, `shift-alone-is-transparent` | The constructor rejects these prompt characters. |
| `empty-target` | The constructor rejects an empty prompt. |
| `replay-conflicts-with-final` | Submission uses the engine buffer. There is no independent recorded final text. |
| `cursor-moved-away-and-back`, `non-shift-modifier` | A caret move or modifier press alone produces no engine edit. |

| Disagreement | What the engine records |
| --- | --- |
| `backspace-on-empty-buffer` | After Backspace then `sun`, it retains `su` and `un`, one 100 ms interval each. A2 discards the sentence. |
| `forward-delete` | After `sand` then Delete at the end, it retains `sa`, `an` and `nd`, one 100 ms interval each. A2 discards the sentence. |

Both edits remove zero characters. These observations enter the user's saved timing history. Each test asserts both the current saved pairs and A2's rejection. The coordinator reserved the eligibility decision for C1b.

## Checks

WSL commands ran from the worktree root with Python 3.14.4.

```sh
export OPENBLAS_NUM_THREADS=1
coach_python=/mnt/c/Users/Owenc/Documents/GitHub/TypeForge/.venv/bin/python
coach_train=/home/owenc/typeforge-data/aalto-136m/dataset-v2/train.npz
"$coach_python" -m ml.coach.browser_table "$coach_train"
"$coach_python" -c 'import sys; from pathlib import Path; from ml.coach.browser_table import TABLE, export; from ml.coach.validation import file_hash; first=TABLE.read_bytes(); export(Path(sys.argv[1])); assert first == TABLE.read_bytes(); print(len(first), file_hash(TABLE))' "$coach_train"
"$coach_python" -m ml.tests.test_browser_table "$coach_train"
"$coach_python" -m unittest discover -s ml/tests
```

All 66 Python tests passed. The following commands ran from `typing-app/client` on Node 24.21.0.

```sh
npm ci
node --experimental-strip-types --test --test-reporter=spec tests/coach-model.test.ts tests/eligibility-parity.test.ts
npm run check
rg --no-ignore -l -F c813005bd99f23fc88b9370490eb8dffa1792c57d5151d23b07047477fe85158 src/generated/coach-model.json dist
```

The two targeted files reported 49 passes and 7 skips. The full check passed with 288 passes, 7 skips, typechecking and a production build.
The initial build included the table through an eager JSON glob. With the glob limited to Ridge and its benchmark, the main bundle fell from 187.03 to 137.53 kB. The digest search returned only the source table.
