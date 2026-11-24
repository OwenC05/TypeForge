# Timing pipeline refactor

The reference is commit `6ce7e02999c668454459da42ad5d832b5f13f9bf` and a private copy
of its published 2,000-participant data. The original checkout was read-only.
The baseline tests were committed at `b18ce1f` and the verified package at `e127208`.

## Package boundaries

| Modules | Responsibility |
| --- | --- |
| `archive`, `acquire` | ZIP64 range reads, stable participant selection and verified cache resume |
| `parse`, `dataset`, `split` | TSV parsing, first-pass eligibility, trial order and partitions |
| `features` | The dense and sparse representations share pair indexing and six context columns |
| `baselines`, `ridge`, `train` | Fit, predict, select on validation and freeze the config |
| `metrics`, `evaluate` | Participant-macro error, bootstrap and registered test evaluation |
| `parity`, `export` | Fitted-estimator fixture checks and serialization of public artifacts |
| `config`, `cli`, `pipeline` | Paths, JSON encoding, stage arguments and the original CLI |

## Reference conditions

The 21 original tests passed. Six additional contracts passed on the unmodified implementation
before the split. They cover TSV quoting and shape, SHIFT and interval boundaries, exact
participant assignments, history features, baseline scores and the published artifact schema.

Both interpreters identify as Python 3.14.4. The supplied venv now reports an August build,
but the frozen environment includes the June 18 2026 14:25:02 build. I extracted Ubuntu's
`3.14.4-1ubuntu0.1` interpreter and standard library under ignored `ml/data/artifacts/runtime/`.
I verified the four package SHA256s against the signed Ubuntu snapshot for 2026-07-15 00:00 UTC.
Both runs used the supplied NumPy 2.5.3, SciPy 1.18.1 and scikit-learn 1.9.1 packages.

OpenBLAS reduction order also affects the coefficient bytes. With one BLAS thread,
the original and refactored trainers independently produced the same canonical config hash,
`a06e6eeccf773e3905d6f7bee3f3c71f265c3042dd411079a8509eff7d155186`.
I used train and validation for this comparison. Old-code runs with two through six threads
also missed the published config hash. The holdout stayed closed for every diagnostic fit.

With the coordinator's approval, the definitive fit used 16 effective OpenBLAS threads on
six CPUs, with no other heavy A1 work. Starting Python under `taskset -c 0-5` alone reduced
both pools to six despite the environment setting. The unchanged config guard rejected that
fit. The replay launcher therefore used `threadpool_limits(16, user_api="blas")` inside the
six-CPU affinity mask and verified both NumPy/SciPy pool sizes and every native thread's mask
before running the normal training CLI. It reproduced the published config and registration
byte for byte. Production code leaves thread counts to its caller.

## Stage commands and results

The source cache was copied into this worktree's ignored `ml/data`. A private copy of the
package under `ml/data/artifacts/replay/` kept the registration, parity and browser outputs
away from tracked paths. The launcher set `TYPEFORGE_DATA_DIR` to the absolute copied data
directory. These were the WSL commands run from the worktree root.

```sh
stage=ml/data/artifacts/stage.sh
sh "$stage" acquire --participants 2000 --seed 42 --max-bytes 268435456
sh "$stage" audit
taskset -c 0-5 env BLAS_THREADS=16 sh "$stage" train
sh "$stage" evaluate --split test
sh "$stage" export
```

| Stage | Result | Elapsed seconds |
| --- | --- | ---: |
| Acquire | 2,002 cached members checked, 2,000 participants, zero network bytes | 10.110 |
| Audit | Regenerated the original trial rows and exclusion counts | 194.121 |
| Train | Selected smoothed-pair k=1 and Ridge alpha=100 on validation | 18.157 |
| Evaluate | The published report and private observation-key file match byte for byte | 19.884 |
| Export | The model, fixture and benchmark payload match with the recorded timing input | 0.146 |

Acquisition replayed the frozen member catalog and source headers in place of the remote ZIP
directory. The real stage read and checked every cached member's length and CRC32 and
regenerated its SHA256. A network call or fallback member fetch would fail the replay.
A local ZIP test independently exercises seeded selection from a larger directory, cache reuse
and repair of a same-size corrupt member. Evaluation ran once after the exact config matched.

The following canonical SHA256 values were the same before and after. The experiment hashes
compact, key-sorted UTF-8 JSON, whereas the files on disk contain indented JSON and a newline.

| Object | SHA256 |
| --- | --- |
| Manifest | `3a756f95c07305c99179bbf1679639e9ec111d5c8e5aa2235df403bac404c30e` |
| Rows | `eceba5f18baa5701eee86299dd87443bd851205e775a29d969da617779a28c6c` |
| Config | `83f562c419d5469f6da2888bc1608312947a4e20d67038e79759dee07aa90324` |

## SHA256 of every output file

Private reference files came from the original data directory. For published artifacts the
comparison used the original Git blob bytes, which preserves LF on a CRLF Windows checkout.
Nine of eleven outputs matched their reference bytes on the timed run. The coordinator
approved the two elapsed-time differences on 24 November under the following checks.

The timing file has the same five stage keys and holds the newly measured durations.
The benchmark captures timings before recording its own export duration. Replacing only
`stageTimingsSeconds` during comparison gave exact JSON equality, including the environment.
A second export with the published timing snapshot as input reproduced the entire benchmark
Git blob byte for byte. The measured run and its timing file were retained separately.

| File | Run | SHA256 of bytes |
| --- | --- | --- |
| manifest.json | Old | `09c09772aad022efdb1c88427db22f46de4b39149e6cb930b5581453f14d5c86` |
| manifest.json | New | `09c09772aad022efdb1c88427db22f46de4b39149e6cb930b5581453f14d5c86` |
| rows.json | Old | `8adf07d3f4538899a0cc295395127b522a9c289c6fca4bd98be93edbb8870193` |
| rows.json | New | `8adf07d3f4538899a0cc295395127b522a9c289c6fca4bd98be93edbb8870193` |
| audit.json | Old | `768a3761ccf84c56d17c596a834a65b7c0983e9025dfa9b78c813bf2a097444b` |
| audit.json | New | `768a3761ccf84c56d17c596a834a65b7c0983e9025dfa9b78c813bf2a097444b` |
| config.json | Old | `6fa25d7462c67643f90ee3c328d4aee7b33c6aaf6ee798765edcf63974ca7100` |
| config.json | New | `6fa25d7462c67643f90ee3c328d4aee7b33c6aaf6ee798765edcf63974ca7100` |
| evaluation-keys.json | Old | `d6747239c83d224008bd938529b6ec794ca3228baa228c18de61d05dbf9db7e9` |
| evaluation-keys.json | New | `d6747239c83d224008bd938529b6ec794ca3228baa228c18de61d05dbf9db7e9` |
| evaluation.json | Old | `1387917e07c4925c813aacbf9f792a78144c8087f4b03180addb6c80c303ad2a` |
| evaluation.json | New | `1387917e07c4925c813aacbf9f792a78144c8087f4b03180addb6c80c303ad2a` |
| timings.json | Old | `ea91a3154ef4fe209f236d4bc3a11385af29f6c81b51b6a12f57d2bd87211163` |
| timings.json | New | `7afb3a16cd143cbce20e41eb46bf5782d7e4e318b52b7e8d5ede2b9aa3e089fd` |
| experiment.json | Old | `a5fbf32547553a80dce1f14f53dc4531e3c3fa0371fe303ad23dddf4fa5d7e8d` |
| experiment.json | New | `a5fbf32547553a80dce1f14f53dc4531e3c3fa0371fe303ad23dddf4fa5d7e8d` |
| parity.json | Old | `877630b476100ba8504a7a83eb337858db4fe871a3d52dfa119559f7c8859035` |
| parity.json | New | `877630b476100ba8504a7a83eb337858db4fe871a3d52dfa119559f7c8859035` |
| model.json | Old | `7ffce48105ac2dc9c9915d01f9277a7f4b7cfeca6d0377ce8d44a8d70536a836` |
| model.json | New | `7ffce48105ac2dc9c9915d01f9277a7f4b7cfeca6d0377ce8d44a8d70536a836` |
| benchmark.json | Old | `3774d21303ec1c56b4467a333d4a759e64b521417dc2d4e44e04f3793e7bcef3` |
| benchmark.json | New | `bc0e766491b6c5a340b3d05322074fb0930e7dcbfd073f969afacc78d4d4b087` |
| benchmark.json | Replay¹ | `3774d21303ec1c56b4467a333d4a759e64b521417dc2d4e44e04f3793e7bcef3` |

¹ Export supplied with the recorded timing input.

The browser files live in `typing-app/client/src/generated/`, the synthetic fixture in
`ml/fixtures/` and the published registration in `ml/`. The other seven files are in
`ml/data/`. The stage logs, replay launchers, `check_outputs.cjs` and `hashes.json` are
under the private `ml/data/artifacts/` directory in this worktree.

## Verification

- `python -m unittest discover -s ml/tests -v` passed 21/21 before and 33/33 after.
  The final suite also passed in a copy with no data directory and with outbound connections
  and DNS lookups blocked. An earlier concurrent run hit a WSL allocation error while importing
  scikit-learn. A serial rerun passed.
- `python -m compileall -q -x '/(data|probes)/' ml` passed.
- Ruff lint and formatting checks passed. All 20 package and test Python files have lines
  of at most 100 characters. Pyright in basic mode checked package modules with the pinned
  scientific packages on its import path and reported zero errors and warnings.
- Git checks confirmed that the `ml/README.md` edit is confined to Reproduce and that the
  published artifacts, client files and scientific requirements match the reference revision.

The additional static checks used Ruff 0.16.10 and the installed Pyright CLI.

```sh
ruff check --no-cache --line-length 100 --exclude data --exclude probes ml
ruff format --check --no-cache --line-length 100 --exclude data --exclude probes ml
pyright --project ml/data/artifacts/pyrightconfig.json --threads 1
git diff --check
```
