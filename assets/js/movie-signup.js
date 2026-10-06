(function () {
  const form = document.getElementById("movie-form");
  if (!form) return;

  const status = form.querySelector(".movie-status");
  const submit = form.querySelector(".movie-submit");
  const boxes = Array.from(form.querySelectorAll('input[name="types"]'));

  document.querySelectorAll("a[data-series]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      boxes.forEach((box) => {
        if (box.value === link.dataset.series) box.checked = true;
      });
      document.getElementById("signup").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = "movie-status" + (kind ? " is-" + kind : "");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = form.elements.name.value.trim();
    const phone = form.elements.phone.value.trim();
    const types = boxes.filter((box) => box.checked).map((box) => box.value);

    if (form.elements.website.value) return;
    if (!name) return setStatus("Please tell me your name.", "error");
    if (!types.length) return setStatus("Choose at least one movie night.", "error");
    if (!/^[+()\d][\d\s().+-]{6,24}$/.test(phone)) return setStatus("Please enter a valid phone number.", "error");

    const endpoint = form.dataset.endpoint;
    if (!endpoint) {
      return setStatus("Sign-ups aren't open just yet. Please check back soon.", "error");
    }

    submit.disabled = true;
    setStatus("Sending…", "pending");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: new URLSearchParams({ name, phone, types: types.join(", ") }),
      });
      const result = await response.json();
      if (!result.ok) {
        submit.disabled = false;
        return setStatus(
          result.error === "bad_phone"
            ? "Please enter a valid phone number."
            : "Something went wrong. Please try again in a moment.",
          "error"
        );
      }
      form.reset();
      form.classList.add("is-sent");
      setStatus("Thank you — you’re on the guest list. I’ll be in touch with invitations.", "success");
    } catch (error) {
      setStatus("Something went wrong. Please try again in a moment.", "error");
      submit.disabled = false;
    }
  });
})();
