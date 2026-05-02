// NAVIGATION
const toolsCard = document.getElementById("toolsCard");

if (toolsCard) {
  toolsCard.addEventListener("click", () => {
    window.location.href = "tools.html";
  });
}

// SEARCH FUNCTION
const searchInput = document.getElementById("searchInput");

if (searchInput) {
  searchInput.addEventListener("keyup", () => {
    const value = searchInput.value.toLowerCase();
    const cards = document.querySelectorAll(".tool-card");

    cards.forEach(card => {
      const name = card.dataset.name;

      if (name.includes(value)) {
        card.style.display = "block";
      } else {
        card.style.display = "none";
      }
    });
  });
}