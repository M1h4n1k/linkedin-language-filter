import LanguageDetect from "languagedetect";

const lngDetector = new LanguageDetect();
lngDetector.setLanguageType("iso3"); // ENG, FIN, etc

const updatePostingLang = (jobLi, lang) => {
  const postingTitle = jobLi.querySelector("a.job-card-list__title");
  if (!postingTitle || postingTitle.innerText === "") return false;
  if (postingTitle.getAttribute("updated") === "true") return true;
  if (postingTitle) {
    // set attribute to prevent multiple updates
    postingTitle.setAttribute("updated", "true");
    postingTitle.innerText = lang + ", " + postingTitle.innerText;
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
  const lang = lngDetector.detect(posting.description)[0][0].toUpperCase();
  const postingId = posting.entityUrn.split(":")[3];
  const jobLi = document.querySelector(
    `li[data-occludable-job-id="${postingId}"]`
  );
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
    // set custom description, cuz it's not consistent between default and prefetch
    pst.description = pst.description.text;
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

  processors[data.type](data);
});
