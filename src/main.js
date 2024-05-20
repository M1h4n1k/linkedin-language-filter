import LanguageDetect from "languagedetect";
import languages from "./languagesISO3.js";

const lngDetector = new LanguageDetect();
lngDetector.setLanguageType("iso3"); // ENG, FIN, etc

const cachedJobs = [];
const langsSelected = [];

// querySelector shortcut
const qr = (selector) => document.querySelector(selector);

// Adds language selector to the filters bar
const buttonAdder = async () => {
  const data = await fetch(browser.runtime.getURL("./src/langSelector.html"));
  const selectorHTML = await data.text();

  const hideSelectorOptions = () => {
    qr("#artdeco-hoverable-artdeco-gen-lang-1").classList.remove(
      "artdeco-hoverable-content--visible"
    );
  };

  qr("ul.search-reusables__filter-list").insertAdjacentHTML(
    "beforeend",
    selectorHTML
  );

  const ul = qr("#lang-options-container");
  lngDetector.getLanguages().forEach((lang, ind) => {
    const langFormatted = lang[0].toUpperCase() + lang.slice(1);
    ul.insertAdjacentHTML(
      "beforeend",
      `
    <li class="search-reusables__collection-values-item">
      <input name="lang-filter-value" id="lang-${ind}" class="search-reusables__select-input" type="checkbox" value="${languages[lang]}">
      <label for="lang-${ind}" class="search-reusables__value-label">
        <p class="display-flex">
          <span class="t-14 t-black--light t-normal" aria-hidden="true"> ${langFormatted} </span>
          <span class="visually-hidden"> Filter by ${langFormatted} </span>
        </p>
      </label>
    </li>
    `
    );
  });

  qr("#lang_cancel").addEventListener("click", hideSelectorOptions);
  const langButtonRect = qr("#searchFilter_lang").getBoundingClientRect();
  const containerRect = qr(
    "#search-reusables__filters-bar"
  ).getBoundingClientRect();
  const selector = qr("#artdeco-hoverable-artdeco-gen-lang-1");
  // center the selector
  selector.style.left =
    langButtonRect.left -
    containerRect.left -
    selector.getBoundingClientRect().width / 2 +
    langButtonRect.width / 2 +
    "px";
  hideSelectorOptions();
  document.querySelectorAll("input[name='lang-filter-value']").forEach((el) => {
    el.addEventListener("change", (e) => {
      const lang = e.target.value;
      if (langsSelected.includes(lang)) {
        langsSelected.splice(langsSelected.indexOf(lang), 1);
      } else {
        langsSelected.push(lang);
      }
      if (langsSelected.length > 0) {
        qr("#langsCount").innerText = langsSelected.length;
        const langSelector = qr("#searchFilter_lang");
        if (!langSelector.classList.contains("artdeco-pill--selected")) {
          langSelector.classList.add("artdeco-pill--selected");
        }
        qr("#langsCount").style.display = "inline-flex";
      } else {
        qr("#langsCount").style.display = "none";
        qr("#searchFilter_lang").classList.remove("artdeco-pill--selected");
      }
    });
  });
  qr("#lang_show").addEventListener("click", () => {
    cachedJobs.forEach(processPosting);
    hideSelectorOptions();
  });

  qr("#searchFilter_lang").addEventListener("click", () => {
    qr("#artdeco-hoverable-artdeco-gen-lang-1").classList.toggle(
      "artdeco-hoverable-content--visible"
    );
  });
};

// adds language to the job posting title
const updatePostingLang = (jobLi, lang) => {
  const postingTitle = jobLi.querySelector("a.job-card-list__title");
  if (!postingTitle || postingTitle.innerText === "") return false;
  if (postingTitle.getAttribute("lang") !== null) return true;
  if (postingTitle) {
    // set attribute to prevent multiple updates
    postingTitle.setAttribute("lang", lang);
    postingTitle.innerText =
      lang + " · " + postingTitle.innerText.split("\n")[0];
    return true;
  }
  return false;
};

/*
 * Taken & modified from https://stackoverflow.com/a/52249124
 * When the posting is updated, we don't need to listen to DOMSubtreeModified anymore
 */
let selfDestructingListener = (element, eventType, callback) => {
  let handler = () => {
    if (callback()) element.removeEventListener(eventType, handler);
  };
  element.addEventListener(eventType, handler);
};

const processPosting = (posting) => {
  if (!cachedJobs.includes(posting)) cachedJobs.push(posting);
  const lang = lngDetector.detect(posting.description)[0][0].toUpperCase();
  const postingId = posting.entityUrn.split(":")[3];
  const jobLi = qr(`li[data-occludable-job-id="${postingId}"]`);
  if (!jobLi) return;
  if (
    lang !== null &&
    langsSelected.length !== 0 &&
    !langsSelected.includes(lang)
  )
    jobLi.style.display = "none";
  else jobLi.style.display = "block";
  if (updatePostingLang(jobLi, lang)) return;

  // not all job postings are visible on page load, so this is needed to update them when they appear
  selfDestructingListener(jobLi, "DOMSubtreeModified", () =>
    updatePostingLang(jobLi, lang)
  );
};

const processPrefetch = (data) => {
  const postings = data.obj.included.filter(
    (obj) => obj.$type === "com.linkedin.voyager.dash.jobs.JobPosting"
  );
  postings.forEach((pst) => {
    pst.description = pst.description.text; // set custom description, cuz it's not consistent between default and prefetch
    processPosting(pst);
  });
};

const processDefault = (data) => {
  const posting = data.obj.included[0];
  // set custom description, cuz it's not consistent between default and prefetch
  posting.description = posting.descriptionText.text;
  processPosting(posting);
};

// listen for messages from background script
browser.runtime.onMessage.addListener((data) => {
  const processors = {
    default: processDefault,
    prefetch: processPrefetch,
  };
  if (qr("#searchFilter_lang") === null) buttonAdder();
  processors[data.type](data);
});
