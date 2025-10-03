// Selecting elements from the DOM
const taskInput = document.getElementById("task-input");
const addTaskBtn = document.getElementById("add-task-btn");
const taskList = document.getElementById("task-list");

// Function to add a new task
function addTask() {
  const taskText = taskInput.value;

  if (taskText === "") {
    alert("Please enter a task!");
    return;
  }

  // Create new list item for the task
  const newTask = document.createElement("li");

  // Add task text
  const taskSpan = document.createElement("span");
  taskSpan.textContent = taskText;
  newTask.appendChild(taskSpan);

  // Add complete button
  const completeBtn = document.createElement("button");
  completeBtn.textContent = "Completed";
  completeBtn.classList.add("complete-btn");
  completeBtn.addEventListener("click", () => {
    newTask.classList.toggle("completed");
    completeBtn.classList.toggle("completed-button")
  });
  newTask.appendChild(completeBtn);

  // Add delete button
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.classList.add("delete-btn");
  deleteBtn.addEventListener("click", () => {
    taskList.removeChild(newTask);
  });
  newTask.appendChild(deleteBtn);

  // Append the task to the task list
  taskList.appendChild(newTask);

  // Clear the input field
  taskInput.value = "";
}

// Event listener for adding a task
addTaskBtn.addEventListener("click", addTask);

// Pressing "Enter" key also adds a task
taskInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    addTask();
  }
});
