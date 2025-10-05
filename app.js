document.addEventListener("DOMContentLoaded", () => {
  // --- DEXIE DATABASE SETUP ---
  const db = new Dexie("KaironDB");
  db.version(1).stores({
    tasks: "++id, status, category, priority, dueDateTime", // ++id is the auto-incrementing primary key
    interests: "++id",
    settings: "key", // A simple key-value store for settings
  });

  // ---- STATE MANAGEMENT ---- //
  const STORAGE_KEY = "kairon_tasks";
  const SETTINGS_KEY = "kairon_settings";
  const INTERESTS_KEY = "kairon_interests";

  let tasks = [];
  let settings = {};
  let interests = [];
  let calendarInstance = null;
  let sortableInstance = null;
  let currentSubtasks = [];

  // ---- CONSTANTS & CONFIG ---- //
  const themeColors = {
    purple: {
      from: "#667eea",
      to: "#764ba2",
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    blue: {
      from: "#3b82f6",
      to: "#1e40af",
      gradient: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
    },
    green: {
      from: "#10b981",
      to: "#047857",
      gradient: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
    },
    red: {
      from: "#ef4444",
      to: "#b91c1c",
      gradient: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
    },
    orange: {
      from: "#f97316",
      to: "#c2410c",
      gradient: "linear-gradient(135deg, #f97316 0%, #c2410c 100%)",
    },
  };
  const darkModes = [
    {
      name: "soft",
      bg: "#1e293b",
      card: "#334155",
      input: "#475569",
      text: "#e2e8f0",
      border: "#475569",
    },
    {
      name: "normal",
      bg: "#0f172a",
      card: "#1e293b",
      input: "#334155",
      text: "#e2e8f0",
      border: "#475569",
    },
    {
      name: "deep",
      bg: "#020617",
      card: "#0f172a",
      input: "#1e293b",
      text: "#e2e8f0",
      border: "#334155",
    },
  ];

  // ---- INITIALIZATION ---- //
async function init() {
    await loadData(); 
    setupEventListeners();
    renderAppLayout();
    showPage(settings.defaultView);
    updateTime();
    setInterval(updateTime, 1000);

    if (settings.theme === "dark") {
      document.body.classList.add("dark");
      document.getElementById("sunIcon").classList.add("hidden");
      document.getElementById("moonIcon").classList.remove("hidden");
      applyDarkMode(darkModes[settings.darkIntensity]);
    }
    updateThemeColor(settings.themeColor);
  }

  // ---- DATA PERSISTENCE ---- //
async function loadData() {
  const defaultSettings = {
    defaultView: "today",
    notifications: "all",
    theme: "light",
    location: "Port Harcourt",
    themeColor: "purple",
    darkIntensity: 1,
  };

  // Load all data in parallel
  const [loadedTasks, loadedInterests, loadedSettings] = await Promise.all([
    db.tasks.toArray(),
    db.interests.toArray(),
    db.settings.get("userSettings"),
  ]);

  tasks = loadedTasks;
  interests = loadedInterests;
  settings = loadedSettings
    ? { ...defaultSettings, ...loadedSettings }
    : defaultSettings;
}



  // ---- UI RENDERING & LAYOUT ---- //
  function renderAppLayout() {
    const appContainer = document.getElementById("app");
    appContainer.innerHTML = `
            <div id="todayPage" class="max-w-6xl mx-auto hidden"></div>
            <div id="tasksPage" class="max-w-6xl mx-auto hidden"></div>
            <div id="calendarPage" class="max-w-6xl mx-auto hidden"></div>
            <div id="analyticsPage" class="max-w-6xl mx-auto hidden"></div>
            <div id="settingsPage" class="max-w-6xl mx-auto hidden"></div>
        `;
  }

  function showPage(pageId) {
    [
      "todayPage",
      "tasksPage",
      "calendarPage",
      "analyticsPage",
      "settingsPage",
    ].forEach((id) => {
      const pageEl = document.getElementById(id);
      if (pageEl) pageEl.style.display = "none";
    });
    const targetPage = document.getElementById(`${pageId}Page`);
    if (targetPage) {
      targetPage.style.display = "block";
      renderPageContent(pageId);
    }
    updateFabVisibility(pageId);
  }

  function renderPageContent(pageId) {
    const pageContainer = document.getElementById(`${pageId}Page`);
    if (!pageContainer) return;

    let html = "";
    switch (pageId) {
      case "today":
        html = getTodayPageHTML();
        pageContainer.innerHTML = html;
        renderTodayPage();
        break;
      case "tasks":
        html = getTasksPageHTML();
        pageContainer.innerHTML = html;
        renderTasks();
        updateFilters();
        break;
      case "calendar":
        html = getCalendarPageHTML();
        pageContainer.innerHTML = html;
        renderCalendar();
        break;
      case "analytics":
        html = getAnalyticsPageHTML();
        pageContainer.innerHTML = html;
        updateAnalytics();
        break;
      case "settings":
        html = getSettingsPageHTML();
        pageContainer.innerHTML = html;
        loadSettings();
        break;
    }
  }

  // ---- THEME & UI HELPERS ---- //
  function updateThemeColor(color) {
    settings.themeColor = color;
    const selectedTheme = themeColors[color];
    document
      .querySelectorAll("#fab, #interestFab, .bg-gradient-to-r")
      .forEach((el) => {
        if (el) el.style.background = selectedTheme.gradient;
      });
    const darkIntensitySlider = document.getElementById("darkIntensity");
    if (darkIntensitySlider) {
      darkIntensitySlider.style.accentColor = selectedTheme.from;
    }
  }

  window.updateDarkIntensityPreview = function (value) {
    const labels = ["Soft", "Normal", "Deep"];
    const intensityLabel = document.getElementById("intensityLabel");
    if (intensityLabel) {
      intensityLabel.textContent = labels[value];
    }
    settings.darkIntensity = parseInt(value);
    if (document.body.classList.contains("dark")) {
      applyDarkMode(darkModes[value]);
    }
  };

  function applyDarkMode(mode) {
    document.body.style.backgroundColor = mode.bg;
    document.body.style.color = mode.text;
    document
      .querySelectorAll(".card, .side-menu, .fixed.top-0, .filter-panel")
      .forEach((el) => {
        if (el && !el.style.background.includes("gradient")) {
          el.style.backgroundColor = mode.card;
        }
      });
    document.querySelectorAll(".bg-gray-50").forEach((el) => {
      if (el) el.style.backgroundColor = mode.input;
    });
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      if (el) {
        el.style.backgroundColor = mode.input;
        el.style.color = mode.text;
        el.style.borderColor = mode.border;
      }
    });
  }

  function removeDarkMode() {
    document.body.style.backgroundColor = "";
    document.body.style.color = "";
    document
      .querySelectorAll(
        ".card, .side-menu, .fixed.top-0, .filter-panel, .bg-gray-50, input, select, textarea"
      )
      .forEach((el) => {
        if (el) {
          el.style.backgroundColor = "";
          el.style.color = "";
          el.style.borderColor = "";
        }
      });
  }

  function updateTime() {
    const now = new Date();
    document.getElementById("currentTime").textContent = now.toLocaleTimeString(
      [],
      { hour: "2-digit", minute: "2-digit" }
    );
  }

  function updateFabVisibility(pageId) {
    const taskFab = document.getElementById("fab");
    const interestFab = document.getElementById("interestFab");
    taskFab.classList.add("hidden");
    interestFab.classList.add("hidden");

    if (pageId === "tasks") {
      taskFab.classList.remove("hidden");
    } else if (pageId === "today") {
      interestFab.classList.remove("hidden");
    }
  }

  function showNotification(title, message) {
    const container = document.getElementById("notificationContainer");
    const notification = document.createElement("div");
    notification.className =
      "notification bg-white rounded-lg shadow-lg p-4 border-l-4 border-purple-600";
    notification.innerHTML = `<h4 class="font-semibold">${title}</h4><p class="text-sm text-gray-600">${message}</p>`;
    container.appendChild(notification);
    setTimeout(() => notification.remove(), 4000);
  }

  // ---- EVENT LISTENERS ---- //
  function setupEventListeners() {
    document.getElementById("themeToggle").addEventListener("click", () => {
      const isDark = document.body.classList.toggle("dark");
      document.getElementById("sunIcon").classList.toggle("hidden", isDark);
      document.getElementById("moonIcon").classList.toggle("hidden", !isDark);
      settings.theme = isDark ? "dark" : "light";
      if (isDark) {
        applyDarkMode(darkModes[settings.darkIntensity]);
      } else {
        removeDarkMode();
      }
      saveData();
    });

    document
      .getElementById("menuBtn")
      .addEventListener("click", () =>
        document.getElementById("sideMenu").classList.add("open")
      );
    document
      .getElementById("closeMenuBtn")
      .addEventListener("click", () =>
        document.getElementById("sideMenu").classList.remove("open")
      );
    document.addEventListener("click", (e) => {
      const menu = document.getElementById("sideMenu");
      const menuBtn = document.getElementById("menuBtn");
      if (
        menu.classList.contains("open") &&
        !menu.contains(e.target) &&
        !menuBtn.contains(e.target)
      ) {
        menu.classList.remove("open");
      }
    });
    document.querySelectorAll(".menu-item").forEach((item) => {
      item.addEventListener("click", () => {
        showPage(item.dataset.view);
        document.getElementById("sideMenu").classList.remove("open");
      });
    });

    document.addEventListener("keydown", (e) => {
      const activeElement = document.activeElement;
      const isTyping =
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA";

      if (e.key === "Escape") {
        closeTaskForm();
        closeEditModal();
      }

      if (e.key.toLowerCase() === "n" && !isTyping) {
        e.preventDefault();
        openTaskForm();
      }

      if (e.key.toLowerCase() === "f" && !isTyping) {
        e.preventDefault();
        const searchInput = document.getElementById("searchInput");
        if (searchInput) {
          searchInput.focus();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        const addTaskForm = document.querySelector("#taskForm");
        const editTaskModal = document.querySelector("#editTaskModal");

        if (addTaskForm && !addTaskForm.classList.contains("hidden")) {
          e.preventDefault();
          addTaskForm.requestSubmit();
        }
        if (editTaskModal && !editTaskModal.classList.contains("hidden")) {
          e.preventDefault();
          document.getElementById("editTaskForm").requestSubmit();
        }
      }
    });
  }

  // ---- SUB-TASK MANAGEMENT ---- //
  window.renderCurrentSubtasks = (formType) => {
    const container = document.getElementById(`${formType}SubtasksContainer`);
    if (!container) return;
    container.innerHTML = currentSubtasks
      .map(
        (subtask, index) => `
            <div class="flex items-center justify-between p-2 rounded-md ${
              subtask.completed ? "bg-gray-100" : ""
            }">
                <label class="flex items-center gap-2 flex-1 cursor-pointer ${
                  subtask.completed ? "subtask-completed" : ""
                }">
                    <input type="checkbox" ${
                      subtask.completed ? "checked" : ""
                    } onchange="handleToggleSubtask(${index}, '${formType}')">
                    <span>${subtask.text}</span>
                </label>
                <button type="button" onclick="handleDeleteSubtask(${index}, '${formType}')" class="p-1 text-red-500 hover:bg-red-100 rounded-full">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
        `
      )
      .join("");
  };

  window.handleAddSubtask = (formType) => {
    const input = document.getElementById(`${formType}SubtaskInput`);
    if (input.value.trim()) {
      currentSubtasks.push({ text: input.value.trim(), completed: false });
      input.value = "";
      renderCurrentSubtasks(formType);
    }
  };

  window.handleToggleSubtask = (index, formType) => {
    currentSubtasks[index].completed = !currentSubtasks[index].completed;
    renderCurrentSubtasks(formType);
  };

  window.handleDeleteSubtask = (index, formType) => {
    currentSubtasks.splice(index, 1);
    renderCurrentSubtasks(formType);
  };

  // ---- TASK MANAGEMENT (CRUD) ---- //
  window.openTaskForm = () => {
    const form = document.querySelector("#tasksPage #taskForm");
    if (form) {
      form.classList.remove("hidden");
      form.querySelector('[name="dueDateTime"]').value = new Date()
        .toISOString()
        .slice(0, 16);
      currentSubtasks = [];
      renderCurrentSubtasks("add");
    }
  };
  window.closeTaskForm = () => {
    const form = document.querySelector("#tasksPage #taskForm");
    if (form) form.classList.add("hidden");
  };

  function scheduleReminder(task, formData) {
    const reminderMinutes = parseInt(formData.get("reminder"));

    if (reminderMinutes && reminderMinutes > 0) {
      const dueDateTime = new Date(task.dueDateTime).getTime();
      const reminderTime = dueDateTime - reminderMinutes * 60 * 1000;
      const now = new Date().getTime();

      if (reminderTime > now) {
        requestNotificationPermission()
          .then(() => {
            setTimeout(() => {
              // Play sound
              const audio = new Audio("/notification.mp3");
              audio.play();

              // Show in-app notification
              showNotification(
                "Task Reminder",
                `Your task "${task.title}" is due soon.`
              );

              //  THE SYSTEM NOTIFICATION
              navigator.serviceWorker.ready.then((registration) => {
                registration.active.postMessage({
                  type: "show-reminder",
                  title: "Kairon Reminder",
                  body: `Your task "${task.title}" is due soon.`,
                  icon: "/favicon/android-chrome-192x192.png",
                });
              });
            }, reminderTime - now);

            console.log(`Notification scheduled for task: ${task.title}`);
          })
          .catch(() => {
            console.log("Notification permission denied.");
          });
      }
    }
  }

window.handleAddTask = async function (event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const task = {
    // Dexie will auto-generate the 'id' field
    title: formData.get("title"),
    category: formData.get("category"),
    priority: formData.get("priority"),
    dueDateTime: formData.get("dueDateTime"),
    recurrence: formData.get("recurrence"),
    tags: formData.get("tags")
      ? formData
          .get("tags")
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t)
      : [],
    notes: formData.get("notes"),
    subtasks: [...currentSubtasks],
    status: "active",
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  // Add the new task to the database and get its generated ID.
  const newId = await db.tasks.add(task);
  task.id = newId;
  tasks.push(task);

  renderTasks();
  updateFilters();
  closeTaskForm();
  event.target.reset();
  showNotification("Success", `"${task.title}" has been added!`);

  scheduleReminder(task, formData);
};

window.handleUpdateTask = async function (event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const taskId = parseInt(formData.get("taskId"));
  const taskIndex = tasks.findIndex((t) => t.id === taskId);
  let updatedTaskData;

  if (taskIndex > -1) {
    updatedTaskData = {
      ...tasks[taskIndex],
      title: formData.get("title"),
      category: formData.get("category"),
      priority: formData.get("priority"),
      dueDateTime: formData.get("dueDateTime"),
      recurrence: formData.get("recurrence"),
      tags: formData.get("tags")
        ? formData
            .get("tags")
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t)
        : [],
      notes: formData.get("notes"),
      subtasks: [...currentSubtasks],
    };
    tasks[taskIndex] = updatedTaskData;
  }

  // Update the task in the database using put().
  if (updatedTaskData) {
    await db.tasks.put(updatedTaskData);
  }

  renderTasks();
  closeEditModal();
  showNotification("Success", `"${tasks[taskIndex].title}" has been updated.`);

  const updatedTask = tasks[taskIndex];
  scheduleReminder(updatedTask, formData);
};

window.completeTask = async function (taskId) {
  const task = tasks.find((t) => t.id === taskId);
  if (task) {
    task.status = "completed";
    task.completedAt = new Date().toISOString();

    // Update the task's status in the database.
    await db.tasks.update(taskId, {
      status: "completed",
      completedAt: task.completedAt,
    });
    renderTasks();
  }
};

window.deleteTask = async function (taskId) {
  if (confirm("Are you sure you want to delete this task?")) {
    tasks = tasks.filter((t) => t.id !== taskId);

    // Delete the task from the database.
    await db.tasks.delete(taskId);
    renderTasks();
  }
};

  window.editTask = function (taskId) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const modal = document.getElementById("editTaskModal");
    const form = document.getElementById("editTaskForm");
    form.querySelector('[name="taskId"]').value = task.id;
    form.querySelector('[name="title"]').value = task.title;
    form.querySelector('[name="category"]').value = task.category;
    form.querySelector('[name="priority"]').value = task.priority;
    form.querySelector('[name="dueDateTime"]').value = task.dueDateTime;
    form.querySelector('[name="recurrence"]').value = task.recurrence || "none";
    form.querySelector('[name="tags"]').value = task.tags
      ? task.tags.join(", ")
      : "";
    form.querySelector('[name="notes"]').value = task.notes || "";

    currentSubtasks = task.subtasks
      ? JSON.parse(JSON.stringify(task.subtasks))
      : [];
    renderCurrentSubtasks("edit");

    modal.classList.remove("hidden");
  };

  window.closeEditModal = () => {
    document.getElementById("editTaskModal").classList.add("hidden");
    currentSubtasks = [];
  };

  // ---- INTERESTS MANAGEMENT ---- //
  window.showInterestFormFab = function () {
    const form = document.getElementById("interestForm");
    if (form) form.classList.remove("hidden");
    document.getElementById("interestTitleInput").focus();
  };
window.addInterest = async function () {
  const titleInput = document.getElementById("interestTitleInput");
  const descInput = document.getElementById("interestDescInput");
  const title = titleInput.value.trim();
  const description = descInput.value.trim();

  if (title) {
    const newInterest = { title, description };
    // Add the new interest to the database.
    const newId = await db.interests.add(newInterest);
    newInterest.id = newId;
    interests.push(newInterest);

    renderInterests();
    cancelInterest();
  }
};
  window.cancelInterest = function () {
    const form = document.getElementById("interestForm");
    if (form) form.classList.add("hidden");
    document.getElementById("interestTitleInput").value = "";
    document.getElementById("interestDescInput").value = "";
  };
window.deleteInterest = async function (id) {
  interests = interests.filter((i) => i.id !== id);
  // Delete the interest from the database.
  await db.interests.delete(id);
  renderInterests();
};

  // ---- FILTERS ---- //
  window.syncFilters = function () {
    document.getElementById("searchInput").value =
      document.getElementById("mobileSearchInput").value;
    document.getElementById("categoryFilter").value = document.getElementById(
      "mobileCategoryFilter"
    ).value;
    document.getElementById("priorityFilter").value = document.getElementById(
      "mobilePriorityFilter"
    ).value;
    document.getElementById("timeFilter").value =
      document.getElementById("mobileTimeFilter").value;
    document.getElementById("tagFilter").value =
      document.getElementById("mobileTagFilter").value;
    filterTasks();
  };

  window.filterTasks = function () {
    const search = document.getElementById("searchInput").value.toLowerCase();
    const category = document.getElementById("categoryFilter").value;
    const priority = document.getElementById("priorityFilter").value;
    const time = document.getElementById("timeFilter").value;
    const tag = document.getElementById("tagFilter").value;

    const filtered = tasks.filter((task) => {
      const matchSearch = task.title.toLowerCase().includes(search);
      const matchCategory = category === "all" || task.category === category;
      const matchPriority = priority === "all" || task.priority === priority;
      const matchTag = tag === "all" || (task.tags && task.tags.includes(tag));
      let matchTime = true;
      if (time === "today")
        matchTime =
          new Date(task.dueDateTime).toDateString() ===
          new Date().toDateString();
      else if (time === "week") {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        matchTime =
          new Date(task.dueDateTime) >= weekStart &&
          new Date(task.dueDateTime) <= weekEnd;
      } else if (time === "overdue")
        matchTime =
          new Date(task.dueDateTime) < new Date() && task.status === "active";
      return (
        matchSearch && matchCategory && matchPriority && matchTag && matchTime
      );
    });
    renderTasks(filtered, false);
  };

  function updateFilters() {
    const categories = [...new Set(tasks.map((t) => t.category))].filter(
      Boolean
    );
    const tags = [...new Set(tasks.flatMap((t) => t.tags || []))].filter(
      Boolean
    );
    const catHTML =
      '<option value="all">All Categories</option>' +
      categories.map((c) => `<option value="${c}">${c}</option>`).join("");
    const tagHTML =
      '<option value="all">All Tags</option>' +
      tags.map((t) => `<option value="${t}">${t}</option>`).join("");

    document
      .querySelectorAll("#categoryFilter, #mobileCategoryFilter")
      .forEach((el) => (el.innerHTML = catHTML));
    document
      .querySelectorAll("#tagFilter, #mobileTagFilter")
      .forEach((el) => (el.innerHTML = tagHTML));
  }

  // ---- DYNAMIC PAGE HTML & RENDER FUNCTIONS ---- //

  function getEmptyStateHTML(message, subtext) {
    return `
            <div class="text-center py-16 px-6">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-gray-200">${message}</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">${subtext}</p>
            </div>
        `;
  }

  // -- TODAY PAGE -- //
function getTodayPageHTML() {
  return `
        <h2 id="greetingHeader" class="text-3xl font-bold mb-6"></h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div class="card p-6" style="background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%);">
                <h3 class="text-xl font-semibold mb-4 text-gray-800">Overdue Tasks</h3>
                <div id="overdueTasksList"></div>
            </div>

            <div class="card p-6" style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);">
                <h3 class="text-xl font-semibold mb-4 text-gray-800">Tasks Due Today</h3>
                <div id="todayTasksList"></div>
            </div>

            <div class="card p-6" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);">
                <h3 class="text-xl font-semibold mb-4 text-gray-800">Things I'm Interested In</h3>
                <div id="interestForm" class="hidden mb-4 bg-white bg-opacity-60 p-4 rounded-lg">
                    <input type="text" id="interestTitleInput" placeholder="Title..." class="w-full px-3 py-2 border rounded-lg text-sm mb-2">
                    <textarea id="interestDescInput" placeholder="Description..." class="w-full px-3 py-2 border rounded-lg text-sm mb-2" rows="2"></textarea>
                    <div class="flex gap-2">
                        <button onclick="addInterest()" class="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Save</button>
                        <button onclick="cancelInterest()" class="flex-1 px-3 py-2 bg-gray-400 text-white rounded-lg text-sm hover:bg-gray-500">Cancel</button>
                    </div>
                </div>
                <div id="interestsList"></div>
            </div>

            <div class="md:col-span-3 card p-6" style="background: linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%);">
                <h3 class="text-lg font-semibold mb-2 text-gray-800">Daily Inspiration</h3>
                <p id="quoteWidget" class="text-sm italic text-gray-700"></p>
            </div>
        </div>`;
}

function renderTodayPage() {
  // --- Greeting and Date Logic (no changes) ---
  const hour = new Date().getHours();
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  let greeting;
  const location = "Switzerland";
  greeting =
    hour < 12
      ? `Good Morning from ${location}!`
      : hour < 18
      ? `Good Afternoon from ${location}!`
      : `Good Evening from ${location}!`;
  document.getElementById(
    "greetingHeader"
  ).textContent = `${greeting} It's ${date}.`;

  // --- Overdue Tasks Logic ---
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const overdueTasks = tasks.filter(
    (task) =>
      new Date(task.dueDateTime) < new Date() && task.status === "active" // Check against current time now
  );

  const overdueList = document.getElementById("overdueTasksList");
  overdueList.innerHTML =
    overdueTasks.length === 0
      ? '<p class="text-gray-600">Nothing is overdue. Great job!</p>'
      : overdueTasks
          .map((task) => {
            // UPDATED: Use the new helper function
            const timeOverdue = formatTimeAgo(task.dueDateTime);
            return `
                <div class="flex items-center justify-between py-2 border-b border-red-300">
                    <span class="font-medium text-gray-800">${task.title}</span>
                    <span class="text-sm text-red-700 font-semibold">${timeOverdue}</span>
                </div>`;
          })
          .join("");

  // --- Tasks Due Today Logic (no changes) ---
  const todayString = startOfToday.toDateString();
  const todayTasks = tasks.filter(
    (task) =>
      new Date(task.dueDateTime).toDateString() === todayString &&
      task.status !== "completed"
  );

  const todayList = document.getElementById("todayTasksList");
  todayList.innerHTML =
    todayTasks.length === 0
      ? '<p class="text-gray-600">No tasks due today. Enjoy!</p>'
      : todayTasks
          .map(
            (task) => `
            <div class="flex items-center justify-between py-2 border-b border-blue-300">
                <span class="font-medium text-gray-800">${task.title}</span>
                <span class="text-sm text-gray-700">${new Date(
                  task.dueDateTime
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}</span>
            </div>`
          )
          .join("");

  // --- Other Widget Rendering (no changes) ---
  renderInterests();
  getDailyQuote();
  getWeather();
}

function formatTimeAgo(dateString) {
  const now = new Date();
  const past = new Date(dateString);
  const seconds = Math.floor((now - past) / 1000);

  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0)
    return years + (years > 1 ? " years overdue" : " year overdue");
  if (months > 0)
    return months + (months > 1 ? " months overdue" : " month overdue");
  if (days > 0) return days + (days > 1 ? " days overdue" : " day overdue");
  if (hours > 0)
    return hours + (hours > 1 ? " hours overdue" : " hour overdue");
  if (minutes > 0)
    return minutes + (minutes > 1 ? " mins overdue" : " min overdue");

  return "Just now overdue";
}

  function renderInterests() {
    const list = document.getElementById("interestsList");
    if (!list) return;
    list.innerHTML =
      interests.length === 0
        ? '<p class="text-gray-600 text-sm">Tap + to add something!</p>'
        : interests
            .map(
              (interest) => `
                <div class="interest-item">
                    <div class="flex items-start justify-between">
                        <div class="flex-1 mr-2">
                            <h4 class="font-semibold text-sm text-gray-800">${
                              interest.title
                            }</h4>
                            ${
                              interest.description
                                ? `<p class="text-xs text-gray-700 mt-1">${interest.description}</p>`
                                : ""
                            }
                        </div>
                        <button onclick="deleteInterest(${
                          interest.id
                        })" class="p-1 hover:bg-gray-200 rounded">
                            <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>
                </div>`
            )
            .join("");
  }

  async function getDailyQuote() {
    const quoteWidget = document.getElementById("quoteWidget");
    if (!quoteWidget) return;
    try {
      const response = await fetch(
        "https://api.quotable.io/random?maxLength=100"
      );
      const data = await response.json();
      quoteWidget.innerHTML = `"${data.content}" <br><span class="font-semibold">— ${data.author}</span>`;
    } catch (error) {
      quoteWidget.textContent = "Could not load quote.";
    }
  }

  async function getWeather() {
    if (!settings.location) return;
    const API_KEY = "8b0f23f305fb73cd36caa7bad774e61c";
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${settings.location}&appid=${API_KEY}&units=metric`
      );
      if (!response.ok) throw new Error("Weather data not found.");
      const data = await response.json();
      const weatherIcons = {
        Clear: "☀️",
        Clouds: "☁️",
        Rain: "🌧️",
        Snow: "❄️",
        Thunderstorm: "⛈️",
        Drizzle: "🌦️",
        Mist: "🌫️",
      };
      document.getElementById("weatherIcon").textContent =
        weatherIcons[data.weather[0].main] || "🌤️";
      document.getElementById("weatherTemp").textContent = `${Math.round(
        data.main.temp
      )}°C`;
    } catch (error) {
      console.error("Weather fetch error:", error);
      document.getElementById("weatherTemp").textContent = "N/A";
    }
  }

  // -- TASKS PAGE -- //
  function getTasksPageHTML() {
    return `
            <button id="mobileFilterBtn" onclick="document.getElementById('filterPanel').classList.add('open')" class="md:hidden mb-4 px-4 py-2 bg-white rounded-lg shadow-sm flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                Filters
            </button>
            <div id="desktopFilters" class="hidden md:block card p-4 mb-6">
                <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div class="tooltip-wrapper"><input type="text" id="searchInput" placeholder="Search tasks (Press 'F')" onkeyup="filterTasks()" class="w-full px-4 py-2 border rounded-lg"><span class="tooltip-content">Search by task title</span></div>
                    <div class="tooltip-wrapper"><select id="categoryFilter" onchange="filterTasks()" class="w-full px-4 py-2 border rounded-lg"></select><span class="tooltip-content">Filter by category</span></div>
                    <div class="tooltip-wrapper"><select id="priorityFilter" onchange="filterTasks()" class="w-full px-4 py-2 border rounded-lg"><option value="all">All Priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><span class="tooltip-content">Filter by priority level</span></div>
                    <div class="tooltip-wrapper"><select id="timeFilter" onchange="filterTasks()" class="w-full px-4 py-2 border rounded-lg"><option value="all">All Time</option><option value="today">Today</option><option value="week">This Week</option><option value="overdue">Overdue</option></select><span class="tooltip-content">Filter by time frame</span></div>
                    <div class="tooltip-wrapper"><select id="tagFilter" onchange="filterTasks()" class="w-full px-4 py-2 border rounded-lg"></select><span class="tooltip-content">Filter by tags</span></div>
                </div>
            </div>
            <div id="filterPanel" class="filter-panel fixed inset-y-0 right-0 w-80 bg-white shadow-lg z-40 md:hidden">
                 <div class="p-4 h-full flex flex-col">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-xl font-bold">Filters</h2>
                        <button onclick="document.getElementById('filterPanel').classList.remove('open')" class="p-2 hover:bg-gray-100 rounded-lg">
                           <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>
                    <div class="space-y-4">
                        <div><label class="block text-sm font-medium mb-2">Search</label><input type="text" id="mobileSearchInput" placeholder="Search tasks..." onkeyup="syncFilters()" class="w-full px-4 py-2 border rounded-lg"></div>
                        <div><label class="block text-sm font-medium mb-2">Category</label><select id="mobileCategoryFilter" onchange="syncFilters()" class="w-full px-4 py-2 border rounded-lg"></select></div>
                        <div><label class="block text-sm font-medium mb-2">Priority</label><select id="mobilePriorityFilter" onchange="syncFilters()" class="w-full px-4 py-2 border rounded-lg"><option value="all">All Priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
                        <div><label class="block text-sm font-medium mb-2">Time</label><select id="mobileTimeFilter" onchange="syncFilters()" class="w-full px-4 py-2 border rounded-lg"><option value="all">All Time</option><option value="today">Today</option><option value="week">This Week</option><option value="overdue">Overdue</option></select></div>
                        <div><label class="block text-sm font-medium mb-2">Tags</label><select id="mobileTagFilter" onchange="syncFilters()" class="w-full px-4 py-2 border rounded-lg"></select></div>
                       <button onclick="document.getElementById('filterPanel').classList.remove('open')" class="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg">Apply Filters</button>
                    </div>
                 </div>
            </div>
            <form id="taskForm" class="mb-6 card p-6 hidden" onsubmit="handleAddTask(event)">
                <h3 class="text-lg font-bold mb-4">Add New Task</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div class="md:col-span-2"><label class="block text-sm font-medium mb-1">Task Title *</label><input type="text" name="title" required class="w-full px-4 py-2 border rounded-lg"></div>
                    <div><label class="block text-sm font-medium mb-1">Category *</label><select name="category" required class="w-full px-4 py-2 border rounded-lg"><option value="">Select Category</option><option value="Work">Work</option><option value="Personal">Personal</option><option value="Shopping">Shopping</option><option value="Health">Health</option><option value="Other">Other</option></select></div>
                    <div><label class="block text-sm font-medium mb-1">Priority</label><select name="priority" class="w-full px-4 py-2 border rounded-lg"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
                    <div><label class="block text-sm font-medium mb-1">Due Date & Time *</label><input type="datetime-local" name="dueDateTime" required class="w-full px-4 py-2 border rounded-lg"></div>
                    <div><label class="block text-sm font-medium mb-1">Recurrence</label><select name="recurrence" class="w-full px-4 py-2 border rounded-lg"><option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
                        <div>
        <label class="block text-sm font-medium mb-1">Reminder</label>
        <select name="reminder" class="w-full px-4 py-2 border rounded-lg" onchange="handleReminderChange(this)">
            <option value="none">None</option>
            <option value="5">5 minutes before</option>
            <option value="15">15 minutes before</option>
            <option value="30">30 minutes before</option>
            <option value="60">1 hour before</option>
        </select>
    </div>
                    <div class="md:col-span-2"><label class="block text-sm font-medium mb-1">Tags (comma-separated)</label><input type="text" name="tags" placeholder="#urgent, #project-alpha" class="w-full px-4 py-2 border rounded-lg"></div>
                    <div class="md:col-span-2"><label class="block text-sm font-medium mb-1">Notes</label><textarea name="notes" rows="2" class="w-full px-4 py-2 border rounded-lg"></textarea></div>
                </div>
                <div class="border-t pt-4 mt-4">
                    <label class="block text-sm font-medium mb-2">Sub-tasks</label>
                    <div id="addSubtasksContainer" class="space-y-2 max-h-40 overflow-y-auto mb-2 pr-2"></div>
                    <div class="flex gap-2">
                        <input type="text" id="addSubtaskInput" placeholder="Add a new sub-task..." class="w-full px-4 py-2 border rounded-lg">
                        <button type="button" onclick="handleAddSubtask('add')" class="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Add</button>
                    </div>
                </div>
                <div class="flex justify-end gap-2 mt-6">
                    <button type="button" onclick="closeTaskForm()" class="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                    <button type="submit" class="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all">Save Task</button>
                </div>
            </form>
            <div class="space-y-4">
                <div class="card overflow-hidden">
                    <div class="px-6 py-4 bg-gray-50 border-b"><h2 class="text-lg font-semibold">Active Tasks</h2></div>
                    <div class="divide-y" id="activeTasksList"></div>
                </div>
                <div class="card overflow-hidden">
                    <div class="px-6 py-4 bg-gray-50 border-b"><h2 class="text-lg font-semibold">Completed Tasks</h2></div>
                    <div class="divide-y" id="completedTasksList"></div>
                </div>
            </div>`;
  }

  function renderTasks(tasksToRender = null, filterSource = true) {
    const tasksSource = tasksToRender || tasks;
    const activeTasks = filterSource
      ? tasksSource
          .filter((t) => t.status === "active")
          .sort((a, b) => new Date(a.dueDateTime) - new Date(b.dueDateTime))
      : tasksSource.filter((t) => t.status === "active");
    const completedTasks = tasksSource.filter((t) => t.status === "completed");

    const priorityColors = {
      high: "bg-red-100 text-red-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-green-100 text-green-800",
    };

    const activeTasksList = document.getElementById("activeTasksList");
    const completedTasksList = document.getElementById("completedTasksList");

    if (activeTasksList) {
      activeTasksList.innerHTML =
        activeTasks.length === 0
          ? getEmptyStateHTML(
              "Your slate is clear.",
              "What will you accomplish today?"
            )
          : activeTasks
              .map((task) => {
                const subtasks = task.subtasks || [];
                const completedSubtasks = subtasks.filter(
                  (st) => st.completed
                ).length;
                const subtaskProgress =
                  subtasks.length > 0
                    ? `(${completedSubtasks}/${subtasks.length})`
                    : "";
                const progressPercentage =
                  subtasks.length > 0
                    ? (completedSubtasks / subtasks.length) * 100
                    : 0;

                return `
                        <div class="px-6 py-4 flex items-start justify-between hover:bg-gray-50 transition-colors" data-task-id="${
                          task.id
                        }">
                            <div class="flex items-start flex-1">
                                <div class="task-draggable pr-4 pt-1 text-gray-400">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                                </div>
                                <div class="flex-1">
                                    <h3 class="font-semibold">${
                                      task.title
                                    } <span class="text-sm font-normal text-gray-500">${subtaskProgress}</span></h3>
                                    <p class="text-sm text-gray-600">Due: ${new Date(
                                      task.dueDateTime
                                    ).toLocaleString()}</p>
                                    
                                    ${
                                      subtasks.length > 0
                                        ? `
                                        <div class="w-full bg-gray-200 rounded-full h-1.5 mt-2 dark:bg-gray-700">
                                            <div class="bg-purple-600 h-1.5 rounded-full" style="width: ${progressPercentage}%"></div>
                                        </div>
                                    `
                                        : ""
                                    }

                                    ${
                                      subtasks.length > 0
                                        ? `
                                        <div class="mt-3 text-sm text-gray-700 space-y-1">
                                            ${subtasks
                                              .map(
                                                (st) => `
                                                <div class="flex items-center gap-2 ${
                                                  st.completed
                                                    ? "subtask-completed"
                                                    : ""
                                                }">
                                                    <span>${
                                                      st.completed ? "✓" : "○"
                                                    }</span>
                                                    <span>${st.text}</span>
                                                </div>
                                            `
                                              )
                                              .join("")}
                                        </div>
                                    `
                                        : ""
                                    }

                                    <div class="flex flex-wrap gap-2 mt-2">
                                        <span class="text-xs px-2 py-1 ${
                                          priorityColors[task.priority]
                                        } rounded-full">${task.priority}</span>
                                        <span class="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">${
                                          task.category
                                        }</span>
                                        ${
                                          task.recurrence &&
                                          task.recurrence !== "none"
                                            ? `<span class="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">🔄 ${task.recurrence}</span>`
                                            : ""
                                        }
                                        ${(task.tags || [])
                                          .map(
                                            (tag) =>
                                              `<span class="text-xs px-2 py-1 bg-gray-200 text-gray-800 rounded-full">${tag}</span>`
                                          )
                                          .join("")}
                                    </div>
                                </div>
                            </div>
                            <div class="flex gap-1 pl-2">
                                <button onclick="editTask(${
                                  task.id
                                })" class="p-2 text-blue-600 hover:bg-blue-100 rounded-full" title="Edit Task"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg></button>
                                <button onclick="completeTask(${
                                  task.id
                                })" class="p-2 text-green-600 hover:bg-green-100 rounded-full" title="Complete Task"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></button>
                                <button onclick="deleteTask(${
                                  task.id
                                })" class="p-2 text-red-600 hover:bg-red-100 rounded-full" title="Delete Task"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                            </div>
                        </div>`;
              })
              .join("");
    }

    if (completedTasksList) {
      completedTasksList.innerHTML =
        completedTasks.length === 0
          ? getEmptyStateHTML(
              "No completed tasks yet.",
              "Time to get started on your goals!"
            )
          : completedTasks
              .map(
                (task) => `
                    <div class="px-6 py-4 flex items-center justify-between hover:bg-gray-50 opacity-70 transition-colors">
                        <div class="flex-1"><h3 class="font-semibold line-through">${
                          task.title
                        }</h3><p class="text-sm text-gray-600">Completed: ${new Date(
                  task.completedAt
                ).toLocaleString()}</p></div>
                        <button onclick="deleteTask(${
                          task.id
                        })" class="p-2 text-red-600 hover:bg-red-100 rounded-full" title="Delete Task"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                    </div>`
              )
              .join("");
    }

    if (sortableInstance) {
      sortableInstance.destroy();
    }
    if (activeTasksList && activeTasks.length > 0) {
      sortableInstance = new Sortable(activeTasksList, {
        handle: ".task-draggable",
        animation: 150,
        ghostClass: "sortable-ghost",
        dragClass: "sortable-drag",
        onEnd: (evt) => {
          const newOrderIds = Array.from(evt.to.children).map((item) =>
            parseInt(item.dataset.taskId)
          );
          tasks.sort((a, b) => {
            if (a.status === "active" && b.status === "active") {
              return newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id);
            }
            return 0;
          });
          saveData();
        },
      });
    }
  }

  // -- CALENDAR PAGE -- //
  function getCalendarPageHTML() {
    return `
            <div class="card p-6 mb-6">
                <h2 class="text-xl font-bold mb-4">Calendar Sync</h2>
                <p class="text-sm text-gray-600 mb-4">Connect your external calendars to see all your events in one place. (Backend required for full functionality).</p>
                <div class="flex flex-col sm:flex-row gap-4">
                    <button onclick="connectGoogleCalendar()" class="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.82l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                        Connect Google Calendar
                    </button>
                    <button onclick="connectAppleCalendar()" class="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 16 16"><path d="M11.182.008C10.148-.03 9.07.258 8.088.66c-1.013.414-2.033.953-2.943 1.55C4.24 2.76 3.322 3.842 2.58 5.105c-.652 1.09-.947 2.458-1.01 3.818-.063 1.357.1 2.77.633 4.043.49 1.18 1.25 2.24 2.13 3.09.87.84 1.87 1.47 2.97 1.81.98.31 2.05.39 3.1.18.92-.19 1.83-.59 2.65-1.18.78-.56 1.45-1.28 2.01-2.14.53-.83.89-1.81.9-2.86-.01-1.1-.38-2.21-1.02-3.2-.61-.95-1.42-1.78-2.36-2.42-1.1-1.01-2.43-1.65-3.83-1.82a4.35 4.35 0 0 0-1.13.04c-.45.08-.88.24-1.28.46-.38.21-.73.48-1.03.8-.28.3-.5.65-.67 1.02-.18.37-.28.78-.29 1.2-.01.48.07.95.23 1.4.15.42.39.82.7 1.16.32.34.7.61 1.12.8.42.18.88.27 1.35.27.42 0 .84-.08 1.24-.24.4-.16.77-.4 1.09-.72.32-.32.58-.7.76-1.12.18-.4.27-.85.27-1.32 0-.3-.04-.6-.12-.89-.08-.29-.2-.56-.37-.8-.17-.24-.38-.45-.62-.63-.24-.18-.52-.32-.82-.41a2.6 2.6 0 0 0-1.14-.1c-.48.05-.95.2-1.38.43-.43.23-.82.55-1.14.94-.32.39-.57.85-.74 1.35-.17.5-.25 1.03-.24 1.57 0 .58.1 1.15.3 1.7.2.54.5 1.05.88 1.5.39.45.85.83 1.38 1.13.53.3 1.12.5 1.75.58.63.08 1.27.06 1.89-.06.62-.12 1.22-.35 1.78-.68.56-.33 1.08-.76 1.53-1.28.45-.52.82-1.1 1.1-1.74.28-.64.45-1.32.49-2.02.04-.7-.04-1.4-.23-2.08s-.5-1.32-.9-1.9c-.4-.58-.88-1.08-1.43-1.5-.55-.42-1.15-.75-1.8-1a5.6 5.6 0 0 0-3.32-.47z"></path><path d="M7.762 3.282c.282-.23.633-.377 1.013-.399.38-.02.76.046 1.12.193.36.147.69.373.96.657.27.284.47.62.59 1.002.12.38.15.79.09 1.192-.06.402-.22.78-.47 1.107s-.59.58-1 .768c-.41.188-.85.28-1.3.27-.45-.01-.89-.12-1.29-.323-.4-.203-.76-.49-1.04-.85-.28-.36-.48-.79-.59-1.25-.11-.46-.12-.94-.03-1.402.09-.46.28-.89.56-1.26.28-.37.64-.67 1.05-.88z"></path></svg>
                        Connect Apple Calendar
                    </button>
                </div>
            </div>
            <div id="calendar" class="card p-4"></div>
        `;
  }

  function renderCalendar() {
    const calendarEl = document.getElementById("calendar");
    if (!calendarEl || !window.FullCalendar) return;
    if (calendarInstance) calendarInstance.destroy();
    calendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,listWeek",
      },
      events: tasks.map((t) => ({
        title: t.title,
        start: t.dueDateTime,
        color:
          t.status === "completed"
            ? "#10B981"
            : themeColors[settings.themeColor].from,
        borderColor:
          t.status === "completed"
            ? "#047857"
            : themeColors[settings.themeColor].to,
      })),
    });
    calendarInstance.render();
  }

  window.connectGoogleCalendar = function () {
    showNotification(
      "Coming Soon!",
      "Full Google Calendar sync requires a backend server."
    );
  };

  window.connectAppleCalendar = function () {
    showNotification(
      "Coming Soon!",
      "Full Apple Calendar sync requires a backend server."
    );
  };

  // -- ANALYTICS PAGE -- //
  function getAnalyticsPageHTML() {
    return `
            <div class="card p-6">
                <h2 class="text-2xl font-bold mb-6">Analytics</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-blue-50 p-6 rounded-lg"><h3 class="font-semibold mb-2 text-gray-700">Completion Rate</h3><p id="completionRate" class="text-3xl font-bold text-blue-600">0%</p></div>
                    <div class="bg-green-50 p-6 rounded-lg"><h3 class="font-semibold mb-2 text-gray-700">On-Time Completion</h3><p id="onTimeRate" class="text-3xl font-bold text-green-600">0%</p></div>
                    <div class="bg-purple-50 p-6 rounded-lg"><h3 class="font-semibold mb-2 text-gray-700">Average Time Accuracy</h3><p id="timeAccuracy" class="text-3xl font-bold text-purple-600">0%</p></div>
                </div>
            </div>`;
  }

  function updateAnalytics() {
    const completed = tasks.filter((t) => t.status === "completed");
    const onTime = completed.filter(
      (t) => new Date(t.completedAt) <= new Date(t.dueDateTime)
    );
    const total = tasks.length;

    document.getElementById("completionRate").textContent = `${
      total > 0 ? ((completed.length / total) * 100).toFixed(0) : 0
    }%`;
    document.getElementById("onTimeRate").textContent = `${
      completed.length > 0
        ? ((onTime.length / completed.length) * 100).toFixed(0)
        : 0
    }%`;

    const accuracies = completed.map((task) => {
      const estimated = new Date(task.dueDateTime) - new Date(task.createdAt);
      const actual = new Date(task.completedAt) - new Date(task.createdAt);
      return isNaN(estimated) || estimated <= 0
        ? 100
        : Math.max(0, 100 - (Math.abs(actual - estimated) / estimated) * 100);
    });
    const avgAccuracy =
      accuracies.length > 0
        ? (accuracies.reduce((a, b) => a + b, 0) / accuracies.length).toFixed(0)
        : 0;
    document.getElementById("timeAccuracy").textContent = `${avgAccuracy}%`;
  }

  // -- SETTINGS PAGE -- //
  function getSettingsPageHTML() {
    return `
            <div class="card p-6">
                <h2 class="text-2xl font-bold mb-6">Settings</h2>
                <form id="settingsForm" onsubmit="saveSettings(event)">
                    <div class="space-y-4">
                        <div><label class="block text-sm font-medium mb-2">Your Location (for weather)</label><input type="text" id="userLocation" name="location" placeholder="e.g., Port Harcourt" class="w-full px-4 py-2 border rounded-lg"></div>
                        <div><label class="block text-sm font-medium mb-2">Default View</label><select name="defaultView" class="w-full px-4 py-2 border rounded-lg"><option value="today">Today</option><option value="tasks">Tasks</option><option value="calendar">Calendar</option><option value="analytics">Analytics</option></select></div>
                        <div><label class="block text-sm font-medium mb-2">Notifications</label><select name="notifications" class="w-full px-4 py-2 border rounded-lg"><option value="all">All Tasks</option><option value="high">High Priority Only</option><option value="none">None</option></select></div>
                        <div><label class="block text-sm font-medium mb-2">Theme Color</label><select id="themeColor" name="themeColor" onchange="updateThemeColor(this.value)" class="w-full px-4 py-2 border rounded-lg"><option value="purple">Purple (Default)</option><option value="blue">Blue</option><option value="green">Green</option><option value="red">Red</option><option value="orange">Orange</option></select></div>
                        <div>
                            <label class="block text-sm font-medium mb-2">Dark Mode Intensity</label>
                            <div class="flex items-center gap-4">
                                <span class="text-xs text-gray-500">Soft</span>
                                <input type="range" id="darkIntensity" name="darkIntensity" min="0" max="2" value="1" step="1" oninput="updateDarkIntensityPreview(this.value)" class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                                <span class="text-xs text-gray-500">Deep</span>
                            </div>
                            <p class="text-xs text-gray-500 mt-1" id="intensityLabel">Normal</p>
                        </div>
                        <button type="submit" class="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all">Save Settings</button>
                    </div>
                </form>
            </div>`;
  }

  function loadSettings() {
    document.getElementById("userLocation").value = settings.location;
    document.querySelector('[name="defaultView"]').value = settings.defaultView;
    document.querySelector('[name="notifications"]').value =
      settings.notifications;
    document.getElementById("themeColor").value = settings.themeColor;
    document.getElementById("darkIntensity").value = settings.darkIntensity;
    updateDarkIntensityPreview(settings.darkIntensity);
    updateThemeColor(settings.themeColor);
  }

window.saveSettings = async function (event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const newSettings = {
    location: formData.get("location"),
    defaultView: formData.get("defaultView"),
    notifications: formData.get("notifications"),
    themeColor: formData.get("themeColor"),
    darkIntensity: parseInt(formData.get("darkIntensity")),
  };

  settings = { ...settings, ...newSettings };

  // Save the settings object to the database with a fixed key.
  await db.settings.put({ key: "userSettings", value: settings });

  updateThemeColor(settings.themeColor);
  getWeather();
  showNotification("Success", "Settings saved!");
};

  window.handleReminderChange = function (selectElement) {
    const reminderValue = selectElement.value;

    // If the user selected a reminder (not 'none') and permission hasn't been granted yet
    if (reminderValue !== "none" && Notification.permission === "default") {
      console.log("User wants a reminder, asking for permission...");
      requestNotificationPermission()
        .then(() => {
          console.log("Permission granted!");
          showNotification("Success", "Notifications are now enabled.");
        })
        .catch(() => {
          console.log("Permission was denied.");
        });
    }
  };
  function requestNotificationPermission() {
    return new Promise((resolve, reject) => {
      if (!("Notification" in window)) {
        alert("This browser does not support desktop notification");
        return reject();
      }

      if (Notification.permission === "granted") {
        return resolve();
      }

      if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            resolve();
          } else {
            reject();
          }
        });
      } else {
        reject();
      }
    });
  }

  // ---- KICK OFF THE APP ---- //
  init();
});
