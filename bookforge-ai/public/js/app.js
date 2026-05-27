document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-checkout]").forEach((button) => {
    button.addEventListener("click", async () => {
      const plan = button.dataset.checkout;
      const token = localStorage.getItem("bookforge_session");
      if (!token) {
        location.href = "dashboard.html";
        return;
      }
      try {
        button.disabled = true;
        button.textContent = "Abriendo Stripe...";
        const response = await fetch("/api/payments/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ plan })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo crear checkout");
        location.href = data.url;
      } catch (error) {
        alert(error.message);
      } finally {
        button.disabled = false;
        button.textContent = plan === "agency" ? "Elegir Agency" : "Elegir Pro";
      }
    });
  });

  const steps = document.querySelectorAll(".process-step");
  if (steps.length) {
    let active = 0;
    setInterval(() => {
      steps.forEach((step, index) => step.classList.toggle("active", index <= active));
      active = (active + 1) % steps.length;
    }, 1100);
  }
});
