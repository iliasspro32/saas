document.addEventListener("DOMContentLoaded", () => {
  const quickForm = document.getElementById("quickEbookForm");
  quickForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const draft = Object.fromEntries(new FormData(quickForm).entries());
    localStorage.setItem("bookforge_draft", JSON.stringify({
      ...draft,
      capitulos: Number(draft.pages) >= 150 ? "20" : "10",
      plataforma: "KDP",
      estilo: "Editorial premium",
      coverMood: "portada premium para ebook comercial"
    }));
    location.href = "index.html";
  });

  document.querySelectorAll("[data-checkout]").forEach((button) => {
    button.addEventListener("click", async () => {
      const plan = button.dataset.checkout;
      const token = localStorage.getItem("bookforge_session");
      if (!token) {
        location.href = "index.html";
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
