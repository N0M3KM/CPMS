# Lab 5 Issues (drafts to post on GitHub)

Label every Issue and Pull Request `lab5`. Branches come from the staging branch `lab5-staging` and
Pull Requests go back into it; a release Pull Request takes staging into `main`. Each Issue names its
requirement (R-xx from the handout), the check it proves (C-xx) and its evidence. Both students are
named on each Issue or PR they work on (R-11).

| # | Issue title | Requirement and check | Assignee / reviewer (suggested) | Done when |
|---|---|---|---|---|
| 1 | Lab 5: GCP Free Trial, project, teammate access, budget alert | Student Guide Ep. 1 | Console work by one member; the other reviews | Billing shows the credit, both members open the project, the budget alert exists. Screenshot attached |
| 2 | Lab 5: Make CPMS cloud-ready (config, static serving, proxy trust) | R-02, R-04 | Jinnakan / Drarun | All settings come from the environment, sessions live in the database, `.env.example` and `deployment.md` list every variable |
| 3 | Lab 5: Containerize CPMS | R-01; C-03 | Jinnakan / Drarun | A fresh clone builds the image and runs with PostgreSQL using only `.env.example` values. Commands and output attached |
| 4 | Lab 5: CI on every Pull Request | R-05; C-01 | Drarun / Jinnakan | A Pull Request shows `test-and-docker` with the build and test results. Run link attached |
| 5 | Lab 5: First deployment to Cloud Run | R-03; C-04 | Console and script run by one member; the other reviews | The public URL opens, sign-in works, the main workflow and one rule rejection are shown with the URL visible |
| 6 | Lab 5: Connect GitHub to GCP and set the merge gate | R-06, R-12; C-02 | Drarun / Jinnakan | Workload Identity Federation and environment `demo` exist; rulesets on staging and `main` require `test-and-docker` and one approval; secret scanning is on; a failing Pull Request from a temporary branch cannot be merged (screenshot) |
| 7 | Lab 5: Deploy workflow and a release from staging into main | R-07, R-08, R-09; C-06 | Both (name both) | A reviewed change goes Issue, PR into staging, release PR into `main`, deploy; `/api/version` shows the commit; PR links and run link attached |
| 8 | Lab 5: Persistence check and rollback | R-04; C-05 | Both | A record created before a restart and a redeploy is still there afterwards (before and after screenshots); rollback by SHA works and roll forward |
| 9 | Lab 5: Finish deployment.md and the PDF | Section 12 of the handout | Both | Every rubric part has a row in the evidence index; the PDF is named `lab5_sec<section>_<group>.pdf` |

## Body template

```
Type: Lab 5 task
Label: lab5
Requirement / check: R-xx / C-xx
Branch: feature/lab5-<short-name> (base and PR target: lab5-staging)
Assignee: <name> (@github)   Reviewer: <name> (@github)
What to do: <steps from the Student Guide episode and deployment.md>
Done when: <observable result from the table above>
Evidence to attach: <links, run URL, captioned screenshot with the commit or URL visible>
Safety: no secrets, passwords, connection strings or keys in commits, logs or screenshots.
```
