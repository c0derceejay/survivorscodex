/* Reset password page — token reset + request new link */

(() => {
  const params = new URLSearchParams(location.search);
  let token = params.get("token") || "";

  const form = document.getElementById("reset-password-form");
  const errEl = document.getElementById("reset-password-err");
  const successEl = document.getElementById("reset-password-success");
  const leadEl = document.getElementById("reset-password-lead");
  const submitBtn = document.getElementById("reset-password-submit");
  const requestPanel = document.getElementById("reset-request-panel");
  const requestForm = document.getElementById("reset-request-form");
  const requestErr = document.getElementById("reset-request-err");
  const requestSuccess = document.getElementById("reset-request-success");
  const requestSuccessMsg = document.getElementById("reset-request-success-msg");
  const requestLinkWrap = document.getElementById("reset-request-link-wrap");
  const requestLink = document.getElementById("reset-request-link");

  function showRequestPanel() {
    form.hidden = true;
    requestPanel.hidden = false;
    leadEl.textContent = "Request a one-time reset link. Links expire after one hour.";
  }

  function showResetForm() {
    form.hidden = false;
    requestPanel.hidden = true;
    leadEl.textContent = "Enter your new password below. Reset links expire after one hour.";
  }

  async function validateToken() {
    if (!token) {
      showRequestPanel();
      return;
    }
    try {
      const res = await fetch(`/api/reset-password/validate?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!data.valid) {
        token = "";
        showRequestPanel();
        if (requestErr) {
          requestErr.textContent = data.error || "This reset link is invalid or has expired. Request a new one below.";
          requestErr.classList.add("show");
        }
      } else {
        showResetForm();
      }
    } catch (_) {
      showResetForm();
    }
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!token) {
      showRequestPanel();
      return;
    }
    errEl.classList.remove("show");
    const password = document.getElementById("reset-password-new").value;
    const confirm = document.getElementById("reset-password-confirm").value;
    if (password.length < 6) {
      errEl.textContent = "Password must be at least 6 characters.";
      errEl.classList.add("show");
      return;
    }
    if (password !== confirm) {
      errEl.textContent = "Passwords do not match.";
      errEl.classList.add("show");
      return;
    }
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>';
    try {
      await SDD.Auth.resetPassword({ token, password });
      form.hidden = true;
      requestPanel.hidden = true;
      successEl.hidden = false;
      leadEl.textContent = "Password updated.";
    } catch (err) {
      errEl.textContent = err.message || "Could not reset password.";
      errEl.classList.add("show");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Update password";
    }
  });

  requestForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    requestErr?.classList.remove("show");
    const email = document.getElementById("reset-request-email").value.trim();
    const btn = document.getElementById("reset-request-submit");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      const data = await SDD.Auth.requestPasswordReset(email);
      requestForm.hidden = true;
      requestSuccess.hidden = false;
      requestSuccessMsg.textContent = data.message || "If an account exists for that email, check your inbox for a reset link.";
      if (data.resetUrl && requestLink && requestLinkWrap) {
        requestLink.href = data.resetUrl;
        requestLinkWrap.hidden = false;
      } else {
        requestLinkWrap.hidden = true;
      }
    } catch (err) {
      requestErr.textContent = err.message || "Could not start password reset.";
      requestErr.classList.add("show");
    } finally {
      btn.disabled = false;
      btn.textContent = "Send reset link";
    }
  });

  document.getElementById("reset-password-signin")?.addEventListener("click", () => {
    window.location.href = "index.html";
    setTimeout(() => SDD.openAuthModal("signin"), 300);
  });

  document.addEventListener("DOMContentLoaded", () => {
    validateToken();
  });
})();
