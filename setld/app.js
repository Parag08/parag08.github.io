const buddyData = {
  Paris: [
    {
      name: "Amelie",
      initials: "AM",
      rating: "4.98",
      note: "Ex-airport host, fluent in English and French, loves first-week checklists.",
      languages: "English, French",
      bestFor: "Airport arrivals",
      activities: ["Airport pickup", "SIM setup", "Cafe orientation"],
      interests: ["Food markets", "Museums", "Metro shortcuts"],
    },
    {
      name: "Nadia",
      initials: "ND",
      rating: "4.94",
      note: "Helps families settle near schools, pharmacies, and transit routes.",
      languages: "English, French, Arabic",
      bestFor: "Family moves",
      activities: ["School basics", "Pharmacy run", "Grocery setup"],
      interests: ["Parks", "Family cafes", "Local services"],
    },
    {
      name: "Leo",
      initials: "LO",
      rating: "4.91",
      note: "Neighborhood walks, bank visits, phone setup, and dinner spots.",
      languages: "English, French, Spanish",
      bestFor: "Neighborhood setup",
      activities: ["Bank visit", "Phone setup", "Area walk"],
      interests: ["Restaurants", "Cycling", "Live music"],
    },
  ],
  London: [
    {
      name: "Maya",
      initials: "MY",
      rating: "4.97",
      note: "Heathrow pickup, Oyster setup, flat handover, and local admin.",
      languages: "English, Hindi",
      bestFor: "Heathrow arrivals",
      activities: ["Airport pickup", "Oyster card", "Flat handover"],
      interests: ["Street food", "Theatre", "Weekend markets"],
    },
    {
      name: "Theo",
      initials: "TH",
      rating: "4.93",
      note: "Great for students and founders moving into East or Central London.",
      languages: "English, German",
      bestFor: "Students and founders",
      activities: ["Coworking tour", "Bank intro", "Transit routes"],
      interests: ["Startups", "Coffee", "East London"],
    },
    {
      name: "Priya",
      initials: "PR",
      rating: "4.96",
      note: "Family arrivals, GP registration, grocery runs, and school basics.",
      languages: "English, Punjabi, Hindi",
      bestFor: "Family settling",
      activities: ["GP registration", "School basics", "Grocery run"],
      interests: ["Family outings", "Libraries", "Community groups"],
    },
  ],
  Berlin: [
    {
      name: "Klara",
      initials: "KL",
      rating: "4.99",
      note: "Anmeldung prep, airport arrival, public transport, and starter kit.",
      languages: "English, German",
      bestFor: "Admin setup",
      activities: ["Anmeldung prep", "Transit pass", "Starter kit"],
      interests: ["Design", "Bakeries", "Local history"],
    },
    {
      name: "Jonas",
      initials: "JO",
      rating: "4.92",
      note: "Tech worker moves, SIM setup, coworking tour, and apartment basics.",
      languages: "English, German",
      bestFor: "Tech relocations",
      activities: ["SIM setup", "Coworking tour", "Apartment basics"],
      interests: ["Tech meetups", "Climbing", "Coffee"],
    },
    {
      name: "Samira",
      initials: "SM",
      rating: "4.95",
      note: "Multilingual concierge for families, pets, and first-week errands.",
      languages: "English, German, Turkish",
      bestFor: "Families and pets",
      activities: ["Pet basics", "Errand route", "Family orientation"],
      interests: ["Parks", "Pet-friendly cafes", "Markets"],
    },
  ],
};

const plans = [
  {
    days: "3",
    name: "Landing",
    price: "$149",
    note: "Airport pickup, care package, and first essentials.",
  },
  {
    days: "7",
    name: "First week",
    price: "$349",
    note: "Daily local guidance, admin help, and neighborhood setup.",
  },
  {
    days: "30",
    name: "Settled",
    price: "$899",
    note: "Ongoing concierge support for housing, services, and routines.",
  },
];

const buddyList = document.querySelector("#buddyList");
const selectedBuddy = document.querySelector("#selectedBuddy");
const mobileSelectedBuddy = document.querySelector("#mobileSelectedBuddy");
const cityButtons = document.querySelectorAll(".city-chip");
const bookButtons = document.querySelectorAll("[data-book-action]");
const scheduleFirstButton = document.querySelector("[data-schedule-first]");
const toast = document.querySelector("#toast");
const homeScreen = document.querySelector("#homeScreen");
const bookingScreen = document.querySelector("#bookingScreen");
const backButton = document.querySelector("#backButton");
const bookingAvatar = document.querySelector("#bookingAvatar");
const bookingBuddy = document.querySelector("#bookingBuddy");
const bookingNote = document.querySelector("#bookingNote");
const bookingRating = document.querySelector("#bookingRating");
const bookingLanguages = document.querySelector("#bookingLanguages");
const bookingBestFor = document.querySelector("#bookingBestFor");
const bookingActivities = document.querySelector("#bookingActivities");
const bookingInterests = document.querySelector("#bookingInterests");
const planList = document.querySelector("#planList");
const planSummary = document.querySelector("#planSummary");
const confirmButton = document.querySelector("#confirmButton");
const cityLabels = document.querySelectorAll("[data-city-label]");
const cityNames = document.querySelectorAll("[data-city-name]");

let activeCity = "Paris";
let activeBuddy = buddyData[activeCity][0];
let activePlan = 0;

function renderBuddies() {
  buddyList.innerHTML = "";

  buddyData[activeCity].forEach((buddy) => {
    const card = document.createElement("button");
    card.className = `buddy-card${buddy.name === activeBuddy.name ? " selected" : ""}`;
    card.type = "button";
    card.setAttribute("aria-label", `Book ${buddy.name}`);
    card.innerHTML = `
      <span class="avatar" aria-hidden="true">${buddy.initials}</span>
      <span class="buddy-copy">
        <strong>${buddy.name}</strong>
        <span>${buddy.note}</span>
      </span>
      <span class="rating">${buddy.rating}</span>
    `;

    card.addEventListener("click", () => {
      activeBuddy = buddy;
      updateSelectedBuddy();
      renderBuddies();
      showBooking();
    });

    buddyList.appendChild(card);
  });
}

function renderPlans() {
  planList.innerHTML = "";

  plans.forEach((plan, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `plan-option${index === activePlan ? " active" : ""}`;
    button.innerHTML = `
      <span class="plan-days">${plan.days}</span>
      <span class="plan-copy">
        <strong>${plan.name}</strong>
        <small>${plan.note}</small>
      </span>
      <span class="plan-price">${plan.price}</span>
    `;
    button.addEventListener("click", () => {
      activePlan = index;
      renderPlans();
      updatePlanSummary();
    });
    planList.appendChild(button);
  });
}

function updateSelectedBuddy() {
  const label = `${activeBuddy.name}, ${activeBuddy.rating} rating`;
  selectedBuddy.textContent = label;
  mobileSelectedBuddy.textContent = label;
  bookingAvatar.textContent = activeBuddy.initials;
  bookingBuddy.textContent = activeBuddy.name;
  bookingNote.textContent = activeBuddy.note;
  bookingRating.textContent = activeBuddy.rating;
  bookingLanguages.textContent = activeBuddy.languages;
  bookingBestFor.textContent = activeBuddy.bestFor;
  renderTags(bookingActivities, activeBuddy.activities);
  renderTags(bookingInterests, activeBuddy.interests);

  cityLabels.forEach((labelNode) => {
    labelNode.textContent = `Welcome to ${activeCity}`;
  });

  cityNames.forEach((cityNode) => {
    cityNode.textContent = activeCity;
  });

  updatePlanSummary();
}

function renderTags(container, items) {
  container.innerHTML = "";

  items.forEach((item) => {
    const tag = document.createElement("span");
    tag.textContent = item;
    container.appendChild(tag);
  });
}

function updatePlanSummary() {
  const plan = plans[activePlan];
  planSummary.textContent = `${plan.days}-day ${plan.name.toLowerCase()} plan`;
}

function showBooking() {
  homeScreen.classList.remove("active");
  bookingScreen.classList.add("active");
  bookingScreen.removeAttribute("aria-hidden");
  homeScreen.setAttribute("aria-hidden", "true");
  updateSelectedBuddy();
  renderPlans();
}

function showHome() {
  bookingScreen.classList.remove("active");
  homeScreen.classList.add("active");
  homeScreen.removeAttribute("aria-hidden");
  bookingScreen.setAttribute("aria-hidden", "true");
}

cityButtons.forEach((button) => {
  button.addEventListener("click", () => {
    cityButtons.forEach((chip) => chip.classList.remove("active"));
    button.classList.add("active");
    activeCity = button.dataset.city;
    activeBuddy = buddyData[activeCity][0];
    updateSelectedBuddy();
    renderBuddies();
  });
});

bookButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showBooking();
  });
});

scheduleFirstButton.addEventListener("click", () => {
  showBooking();
});

backButton.addEventListener("click", () => {
  showHome();
});

confirmButton.addEventListener("click", () => {
  toast.textContent = `${activeBuddy.name} is requested for ${activeCity} with the ${planSummary.textContent}.`;
  toast.classList.add("show");

  window.setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
});

renderBuddies();
renderPlans();
updateSelectedBuddy();
