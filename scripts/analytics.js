(function () {
  window.dataLayer = window.dataLayer || [];

  function push(event, parameters) {
    window.dataLayer.push({
      event,
      page_location: window.location.href,
      page_path: window.location.pathname,
      ...parameters,
    });
  }

  function loadScript(source) {
    const script = document.createElement("script");
    script.async = true;
    script.src = source;
    document.head.append(script);
  }

  const gtmId = document.documentElement.dataset.gtmId;
  const ga4Id = document.documentElement.dataset.ga4Id;
  if (gtmId) {
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`);
  } else if (ga4Id) {
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`);
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", ga4Id);
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    const explicitEvent = link.dataset.analyticsEvent;
    const path = new URL(link.href, window.location.href).pathname;
    const ctaType = path.startsWith("/contact")
      ? "contact"
      : path.startsWith("/download")
        ? "download"
        : null;
    if (explicitEvent) {
      push(explicitEvent, { item_id: link.dataset.analyticsLabel || path });
    } else if (ctaType) {
      push("cta_click", { cta_type: ctaType, link_url: link.href, link_text: link.textContent.trim() });
    }
  });

  const formEvents = {
    onFormReady: "form_start",
    onFormSubmitted: "form_submit_success",
    onFormSubmitError: "form_submit_error",
  };
  window.addEventListener("message", (event) => {
    if (event.data?.type !== "hsFormCallback") return;
    const analyticsEvent = formEvents[event.data.eventName];
    if (analyticsEvent) push(analyticsEvent, { form_id: event.data.id || "hubspot" });
  });
  for (const eventName of ["form_start", "form_submit_success", "form_submit_error"]) {
    document.addEventListener(`strix:${eventName}`, (event) => {
      push(eventName, { form_id: event.detail?.formId || "unknown" });
    });
  }
})();
