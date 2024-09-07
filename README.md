# ![logo](https://github.com/M1h4n1k/linkedin-language-filter/assets/82715719/f83d5145-397f-4585-93bb-5944d8c4ebef) LinkedIn jobs language filter

## Idea

While searching for jobs on LinkedIn there are a lot of jobs with descriptions in languages that I don't know. So I would like to hide those jobs, however LinkedIn doesn't provide such option.
I searched for extensions online and could find only one that barely works and only for chrome, but I want it for firefox as I use it as my main browser. That's why I decided to write it

## How to install?

Just install [the add-on from firefox add-ons store](https://addons.mozilla.org/en-US/firefox/addon/linkedin-jobs-language-filter) and start using it on [the jobs page](https://www.linkedin.com/jobs/search)

## How to build from source

1. Clone the repository `git clone https://github.com/M1h4n1k/linkedin-language-filter.git`
2. Install the dependencies `npm install`
3. Build the project `npx webpack --mode production`
4. Open `about:debugging#/runtime/this-firefox` in firefox
5. Press "Load temporary Add-on" and select any file in the directory with the extension, e.g. manifest.json

## Implementation

Background script intercepts all requests for getting job posts' data and then passes that to the content script. After that content script adds detects the language of the post using `languagedetect` and adds it to the beginning of the post title

![image](https://github.com/M1h4n1k/linkedin-language-filter/assets/82715719/3c4b37fd-c376-4c77-97ae-4a993e021dc2)

Moreover, you can filter jobs using the language filter at the top

![image](https://github.com/M1h4n1k/linkedin-language-filter/assets/82715719/d7ca252b-e6ac-425c-9689-03164cd885e1)

## TODO

- Improve design of the language selector and make it more similar to the others
- Probably save the languages to some storage so that the user doesn't have to set the filters each time
