// sending message to content script
const sendMessage = async (message, tabId) => {
  await browser.tabs.sendMessage(tabId, message);
};

const processPrefetch = (data) => {
  for (const obj of data.included) {
    if (obj.$type !== "com.linkedin.voyager.dash.jobs.JobPosting") continue;
    // ...
  }
  return data;
};

const listener = (type) => {
  return (requestDetails) => {
    let filter = browser.webRequest.filterResponseData(
      requestDetails.requestId
    );
    let decoder = new TextDecoder("utf-8");
    let encoder = new TextEncoder();
    let str = "";

    filter.ondata = (event) => {
      str += decoder.decode(event.data, { stream: true });
    };

    filter.onstop = () => {
      let objs = JSON.parse(str);
      // if (type === "prefetch") objs = processPrefetch(objs);
      filter.write(encoder.encode(JSON.stringify(objs)));
      sendMessage(
        {
          type: type,
          obj: objs,
        },
        requestDetails.tabId
      );

      filter.disconnect();
    };

    return {};
  };
};

browser.webRequest.onBeforeRequest.addListener(
  listener("default"),
  {
    urls: [
      "https://www.linkedin.com/voyager/api/graphql?*JOB_DESCRIPTION_CARD*",
    ],
  },
  ["blocking"]
);

browser.webRequest.onBeforeRequest.addListener(
  listener("prefetch"),
  {
    urls: [
      "https://www.linkedin.com/voyager/api/graphql?*jobCardPrefetchQuery*",
    ],
  },
  ["blocking"]
);
