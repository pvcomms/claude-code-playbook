# mcp-tool-selection-eval

**Tool menu:** 77 tools  
**Testcases:** 31  
**Models:** opus, sonnet, haiku, gpt, gemini

## Accuracy by category

| Model | Direct | Semantic | Ambiguous | Negative | Overall |
|-------|--------|----------|-----------|----------|---------|
| opus | 4/7 (57%) | 7/12 (58%) | 5/7 (71%) | 5/5 (100%) | 21/31 (68%) |
| sonnet | 4/7 (57%) | 9/12 (75%) | 6/7 (86%) | 5/5 (100%) | 24/31 (77%) |
| haiku | 4/7 (57%) | 9/12 (75%) | 4/7 (57%) | 5/5 (100%) | 22/31 (71%) |
| gpt | 5/7 (71%) | 7/12 (58%) | 2/7 (29%) | 5/5 (100%) | 19/31 (61%) |
| gemini | 2/7 (29%) | 4/12 (33%) | 2/7 (29%) | 5/5 (100%) | 13/31 (42%) |

## Performance

| Model | Calls | Avg latency | Total tokens (in/out) | Total cost |
|-------|-------|-------------|-----------------------|------------|
| opus | 31 | 2.8s | 222020/3161 | $3.5674 |
| sonnet | 31 | 2.7s | 163787/2622 | $0.5307 |
| haiku | 31 | 1.6s | 164004/2859 | $0.1783 |
| gpt | 31 | 8.6s | 69888/20371 | $0.2911 |
| gemini | 31 | 5.1s | 99229/522 | $0.1293 |

## Failures — per-case inspector

| Model | Case | Category | Expected | Got | Reason |
|-------|------|----------|----------|-----|--------|
| opus | `direct-04` | direct | `gmail-create-draft` | `(no tool)` | no tool called; expected gmail-create-draft |
| opus | `direct-05` | direct | `calendar-suggest-time` | `(no tool)` | no tool called; expected calendar-suggest-time |
| opus | `direct-06` | direct | `figma-get-screenshot` | `(no tool)` | no tool called; expected figma-get-screenshot |
| opus | `semantic-01` | semantic | `notion-create-pages` | `(no tool)` | no tool called; expected notion-create-pages |
| opus | `semantic-06` | semantic | `todoist-close-task` | `(no tool)` | no tool called; expected todoist-close-task |
| opus | `semantic-07` | semantic | `slack-send-message` | `(no tool)` | no tool called; expected slack-send-message |
| opus | `semantic-09` | semantic | `linear-create-issue` | `(no tool)` | no tool called; expected linear-create-issue |
| opus | `semantic-10` | semantic | `figma-get-variable-defs` | `(no tool)` | no tool called; expected figma-get-variable-defs |
| opus | `ambiguous-03` | ambiguous | `chrome-get-page-text` | `chrome-navigate` | Called chrome-navigate instead of chrome-get-page-text; didn't extract text as requested. |
| opus | `ambiguous-04` | ambiguous | `todoist-delete-task` | `todoist-filter-tasks` | Called filter-tasks to search; expected delete-task. Finding first is reasonable but wrong tool for  |
| sonnet | `direct-04` | direct | `gmail-create-draft` | `(no tool)` | no tool called; expected gmail-create-draft |
| sonnet | `direct-05` | direct | `calendar-suggest-time` | `(no tool)` | no tool called; expected calendar-suggest-time |
| sonnet | `direct-06` | direct | `figma-get-screenshot` | `(no tool)` | no tool called; expected figma-get-screenshot |
| sonnet | `semantic-01` | semantic | `notion-create-pages` | `(no tool)` | no tool called; expected notion-create-pages |
| sonnet | `semantic-06` | semantic | `todoist-close-task` | `todoist-filter-tasks` | picked todoist-filter-tasks; expected todoist-close-task |
| sonnet | `semantic-07` | semantic | `slack-send-message` | `(no tool)` | no tool called; expected slack-send-message |
| sonnet | `ambiguous-03` | ambiguous | `chrome-get-page-text` | `chrome-navigate` | Called chrome-navigate instead of chrome-get-page-text; navigation alone doesn't extract text. |
| haiku | `direct-04` | direct | `gmail-create-draft` | `(no tool)` | no tool called; expected gmail-create-draft |
| haiku | `direct-05` | direct | `calendar-suggest-time` | `(no tool)` | no tool called; expected calendar-suggest-time |
| haiku | `direct-06` | direct | `figma-get-screenshot` | `(no tool)` | no tool called; expected figma-get-screenshot |
| haiku | `semantic-01` | semantic | `notion-create-pages` | `(no tool)` | no tool called; expected notion-create-pages |
| haiku | `semantic-06` | semantic | `todoist-close-task` | `todoist-filter-tasks` | picked todoist-filter-tasks; expected todoist-close-task |
| haiku | `semantic-07` | semantic | `slack-send-message` | `(no tool)` | no tool called; expected slack-send-message |
| haiku | `ambiguous-03` | ambiguous | `chrome-get-page-text` | `chrome-navigate` | Called chrome-navigate instead of chrome-get-page-text to extract text content. |
| haiku | `ambiguous-04` | ambiguous | `todoist-delete-task` | `todoist-filter-tasks` | Used filter-tasks instead of delete-task; should have called delete directly or at minimum list-task |
| haiku | `ambiguous-07` | ambiguous | `notion-duplicate-page` | `notion-search` | Used search instead of duplicate-page; should have called notion-duplicate-page directly or at least |
| gpt | `direct-04` | direct | `gmail-create-draft` | `(no tool)` | no tool called; expected gmail-create-draft |
| gpt | `direct-06` | direct | `figma-get-screenshot` | `(no tool)` | no tool called; expected figma-get-screenshot |
| gpt | `semantic-01` | semantic | `notion-create-pages` | `(no tool)` | no tool called; expected notion-create-pages |
| gpt | `semantic-05` | semantic | `gmail-search-threads` | `(no tool)` | no tool called; expected gmail-search-threads |
| gpt | `semantic-06` | semantic | `todoist-close-task` | `(no tool)` | no tool called; expected todoist-close-task |
| gpt | `semantic-07` | semantic | `slack-send-message` | `(no tool)` | no tool called; expected slack-send-message |
| gpt | `semantic-09` | semantic | `linear-create-issue` | `(no tool)` | no tool called; expected linear-create-issue |
| gpt | `ambiguous-01` | ambiguous | `todoist-filter-tasks` | `(no tool)` | Model returned no tool call; expected todoist-filter-tasks for 'today' smart query. |
| gpt | `ambiguous-03` | ambiguous | `chrome-get-page-text` | `(no tool)` | Model did not call chrome-get-page-text; no tool invoked. |
| gpt | `ambiguous-04` | ambiguous | `todoist-delete-task` | `(no tool)` | Model gave no tool call; expected todoist-delete-task. |
| gpt | `ambiguous-05` | ambiguous | `todoist-create-task` | `(no tool)` | Asked clarifying question and suggested calendar event as default instead of creating Todoist task. |
| gpt | `ambiguous-07` | ambiguous | `notion-duplicate-page` | `(no tool)` | Model did not call any tool; expected notion-duplicate-page. |
| gemini | `direct-02` | direct | `whoop-list-recoveries` | `(no tool)` | no tool called; expected whoop-list-recoveries |
| gemini | `direct-03` | direct | `todoist-filter-tasks` | `(no tool)` | no tool called; expected todoist-filter-tasks |
| gemini | `direct-04` | direct | `gmail-create-draft` | `(no tool)` | no tool called; expected gmail-create-draft |
| gemini | `direct-05` | direct | `calendar-suggest-time` | `(no tool)` | no tool called; expected calendar-suggest-time |
| gemini | `direct-06` | direct | `figma-get-screenshot` | `(no tool)` | no tool called; expected figma-get-screenshot |
| gemini | `semantic-01` | semantic | `notion-create-pages` | `(no tool)` | no tool called; expected notion-create-pages |
| gemini | `semantic-02` | semantic | `whoop-list-recoveries` | `(no tool)` | no tool called; expected whoop-list-recoveries |
| gemini | `semantic-03` | semantic | `todoist-create-task` | `(no tool)` | no tool called; expected todoist-create-task |
| gemini | `semantic-04` | semantic | `calendar-create-event` | `(no tool)` | no tool called; expected calendar-create-event |
| gemini | `semantic-06` | semantic | `todoist-close-task` | `(no tool)` | no tool called; expected todoist-close-task |
| gemini | `semantic-07` | semantic | `slack-send-message` | `(no tool)` | no tool called; expected slack-send-message |
| gemini | `semantic-09` | semantic | `linear-create-issue` | `(no tool)` | no tool called; expected linear-create-issue |
| gemini | `semantic-11` | semantic | `notion-fetch` | `(no tool)` | no tool called; expected notion-fetch |
| gemini | `ambiguous-03` | ambiguous | `chrome-get-page-text` | `(no tool)` | Model did not call chrome-get-page-text; returned no tool call. |
| gemini | `ambiguous-04` | ambiguous | `todoist-delete-task` | `todoist-list-tasks` | Called list-tasks instead of delete-task; should have deleted directly or at least attempted deletio |
| gemini | `ambiguous-05` | ambiguous | `todoist-create-task` | `(no tool)` | Model refused instead of creating Todoist task; asked user to choose rather than disambiguating. |
| gemini | `ambiguous-06` | ambiguous | `whoop-list-recoveries` | `(no tool)` | Model gave no tool call; expected whoop-list-recoveries to fetch HRV data. |
| gemini | `ambiguous-07` | ambiguous | `notion-duplicate-page` | `notion-search` | Called search instead of duplicate-page; user asked to duplicate template, not find it. |
