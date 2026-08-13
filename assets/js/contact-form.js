function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const status = form.querySelector(".contact-status");
  const submitBtn = form.querySelector(".contact-submit");
  const honeypot = form.querySelector(".form-honeypot");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (honeypot && honeypot.value) return;

    submitBtn.disabled = true;
    submitBtn.classList.add("is-sending");
    status.textContent = "Sending…";
    status.className = "contact-status is-pending";

    try {
      const formData = new FormData(form);
      const response = await fetch("https://formsubmit.co/ajax/asy9dh@gmail.com", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData,
      });

      if (!response.ok) throw new Error("Request failed");

      form.reset();
      form.classList.add("is-sent");
      status.textContent = "Thank you — your message has been sent. I'll get back to you soon.";
      status.className = "contact-status is-success";
    } catch (err) {
      status.textContent = "Something went wrong. Please try again or email asy9dh@gmail.com directly.";
      status.className = "contact-status is-error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("is-sending");
    }
  });
}

document.addEventListener("DOMContentLoaded", initContactForm);
