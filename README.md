# ![logo](https://github.com/M1h4n1k/linkedin-language-filter/assets/82715719/f83d5145-397f-4585-93bb-5944d8c4ebef) LinkedIn jobs language filter

## Idea

While searching for jobs on LinkedIn there are a lot of jobs with descriptions in languages that I don't know. So I would like to hide those jobs, however LinkedIn doesn't provide such option.
I searched for extensions online and could find only one that barely works and only for chrome, but I want it for firefox as I use it as my main browser. That's why I decided to write it

## How to install?

Just install [the add-on from firefox add-ons store](https://addons.mozilla.org/en-US/firefox/addon/linkedin-jobs-language-filter) and start using it on [the jobs page](https://www.linkedin.com/jobs/search)

## How to run from source

There is no build step.

1. Clone the repository `git clone https://github.com/M1h4n1k/linkedin-language-filter.git`
2. Open `about:debugging#/runtime/this-firefox` in firefox
3. Press "Load temporary Add-on" and select `manifest.json`

## Implementation

LinkedIn's job search (`/jobs/search-results/`) no longer sends job data as interceptable JSON, so the content script works from the page:

- every job card is found by its `componentkey="job-card-component-ref-<jobId>"` attribute
- the posting's description is fetched from `/voyager/api/jobs/jobPostings/<jobId>` (3 requests at a time)
- its language is detected with the browser's built-in `i18n.detectLanguage`, shown as a badge before the job title and cached in `storage.local`
- a "Languages" pill is added to LinkedIn's filter bar (or floats in the bottom-right corner if the bar can't be found); it lists the languages found on the page, and checking some hides every job in another language. The selection is saved between visits

The language is the one the description is written in, not the languages the job asks for.

## Privacy

Nothing leaves your browser except the requests to linkedin.com, made with your own session, for the jobs you are looking at. The chosen languages and the detected language of each job id are kept in the extension's local storage.

Those requests go to LinkedIn's internal API, roughly one per job shown. That is what the LinkedIn site does itself, but LinkedIn's terms discourage automated access, so use it at your own discretion.
