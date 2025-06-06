// ---------------------------
// Variables globales
// ---------------------------
let excelData = [];
let selectedModule = "";
let selectedTeacher = "";
let microdisenoUploaded = false;
let currentStep = 1;
let webhookData = null;
let notificationCount = 0;
let eventSource = null;
// Ya no generamos el token automáticamente; lo pedimos al usuario:
let sessionToken = null;

// Añadir variables para controlar la sección de coherencia
// (donde se mostrarán los selects y el botón de “Subir reporte”)
const coherenciaSection = document.getElementById("coherenciaSection"); // Debe existir en el HTML
const reporteCoherenciaButton = document.getElementById("reporteCoherenciaButton"); // Botón para enviar reporte

// ---------------------------
// Elementos del DOM
// ---------------------------
const excelFileInput = document.getElementById("excelFile");
const excelFileName = document.getElementById("excelFileName");
const moduleSelect = document.getElementById("moduleSelect");
const teacherSelect = document.getElementById("teacherSelect");
const resultsSection = document.getElementById("resultsSection");
const resultsBody = document.getElementById("resultsBody");
const microdisenoSection = document.getElementById("microdisenoSection");
const microdisenoFileElement = document.getElementById("microdisenoFile");
const microdisenoFileName = document.getElementById("microdisenoFileName");
const submitSection = document.getElementById("submitSection");
const submitButton = document.getElementById("submitButton");
const messageDiv = document.getElementById("message");
const steps = document.querySelectorAll(".step");

// Elementos del webhook
const webhookResults = document.getElementById("webhookResults");
const webhookTableBody = document.getElementById("webhookTableBody");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const notificationBadge = document.getElementById("notificationBadge");
const copyUrlBtn = document.getElementById("copyUrlBtn");

// Elementos del modal de texto
const textModal = document.getElementById("textModal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const closeModalButton = document.getElementById("closeModalButton");
const closeModalX = document.querySelector(".close-modal");

// ---------------------------
// Event Listeners
// ---------------------------
excelFileInput.addEventListener("change", handleExcelUpload);
moduleSelect.addEventListener("change", handleModuleChange);
teacherSelect.addEventListener("change", handleTeacherChange);
microdisenoFileElement.addEventListener("change", handleMicrodisenoUpload);
submitButton.addEventListener("click", submitReport);
closeModalButton.addEventListener("click", closeModal);
closeModalX.addEventListener("click", closeModal);
copyUrlBtn.addEventListener("click", copyWebhookUrl);
// Botón que envía el reporte de coherencia “al final”
reporteCoherenciaButton.addEventListener("click", enviarReporteCoherencia);

// ---------------------------
// Al cargar la página: pedir al usuario el sessionToken y, luego, conectar al SSE
// ---------------------------
window.addEventListener("DOMContentLoaded", () => {
  // Pedimos el sessionToken en bucle hasta que el usuario ingrese algo válido
  while (!sessionToken) {
    const input = prompt("Por favor, ingrese el sessionToken:");
    if (input && input.trim() !== "") {
      sessionToken = input.trim();
    }
  }

  // Una vez tenemos sessionToken, inicializamos la conexión SSE
  initWebhookConnection();

  // Ajustamos la vista inicial de secciones según pasos
  updateStepIndicator(1);

  // Por defecto, ocultamos la sección de coherencia hasta que haya datos
  coherenciaSection.classList.add("hidden");
});

// ---------------------------
// Función para inicializar la conexión del webhook usando Server-Sent Events (SSE)
// ---------------------------
function initWebhookConnection() {
  console.log("Token de sesión proporcionado:", sessionToken);

  // URL del servidor de webhook (reemplaza con tu propia URL si cambió)
  const serverUrl = "https://proyectousa.onrender.com";

  try {
    // Creamos una conexión SSE con el token de sesión
    eventSource = new EventSource(`${serverUrl}/events?token=${encodeURIComponent(sessionToken)}`);

    // Cuando la conexión se abre
    eventSource.onopen = () => {
      console.log("Conexión SSE establecida");
      statusDot.classList.remove("offline");
      statusDot.classList.add("online");
      statusText.textContent = "Webhook conectado";
    };

    // Cuando recibimos el evento personalizado “webhook-data”
    eventSource.addEventListener("webhook-data", (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebhookData(data);
      } catch (error) {
        console.error("Error al procesar los datos del webhook:", error);
      }
    });

    // Manejo de errores de conexión
    eventSource.onerror = () => {
      console.error("Error en la conexión SSE");
      statusDot.classList.remove("online");
      statusDot.classList.add("offline");
      statusText.textContent = "Webhook desconectado";

      // Intentar reconectar después de 5 segundos
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CLOSED) {
          initWebhookConnection();
        }
      }, 5000);
    };
  } catch (error) {
    console.error("Error al inicializar la conexión SSE:", error);
    statusDot.classList.remove("online");
    statusDot.classList.add("offline");
    statusText.textContent = "Error de conexión";
  }
}

// ---------------------------
// Función utilitaria para formatear fechas de Excel (para resultados)
// ---------------------------
function formatExcelDate(excelDate) {
  if (!excelDate || isNaN(excelDate)) return excelDate;
  const excelStartDate = new Date(1900, 0, 1);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const actualDate = new Date(excelStartDate.getTime() + (excelDate - 2) * millisecondsPerDay);
  const day = actualDate.getDate().toString().padStart(2, "0");
  const month = (actualDate.getMonth() + 1).toString().padStart(2, "0");
  const year = actualDate.getFullYear();
  return `${day}/${month}/${year}`;
}

// ---------------------------
// Función utilitaria para formatear horas de Excel
// ---------------------------
function formatExcelTime(excelTime) {
  if (!excelTime || isNaN(excelTime)) return excelTime;
  const totalMinutes = Math.round(excelTime * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

// ---------------------------
// Función para mostrar un mensaje en pantalla
// ---------------------------
function showMessage(text, type) {
  messageDiv.innerHTML = text;
  messageDiv.className = "message " + type;
  messageDiv.classList.remove("hidden");

  // Ocultar el mensaje después de 5 segundos si es de tipo éxito
  if (type === "success") {
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }
}

// ---------------------------
// Actualizar indicador de pasos (sidebar u otra UI que tengas)
// ---------------------------
function updateStepIndicator(step) {
  currentStep = step;
  steps.forEach((stepEl, index) => {
    const stepNum = index + 1;
    if (stepNum < step) {
      stepEl.classList.add("completed");
      stepEl.classList.remove("active");
    } else if (stepNum === step) {
      stepEl.classList.add("active");
      stepEl.classList.remove("completed");
    } else {
      stepEl.classList.remove("active", "completed");
    }
  });
}

// ---------------------------
// Manejo de carga de archivo Excel
// ---------------------------
function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  excelFileName.textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      excelData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (excelData.length < 2) {
        showMessage("El archivo no contiene datos suficientes", "error");
        return;
      }

      const headers = excelData[0];
      const expectedHeaders = [
        "Módulo",
        "Grupo",
        "Docente",
        "Fecha de Clase",
        "Tema",
        "Fecha Ingreso",
        "Hrs. Clase",
        "Hora Ingreso",
      ];
      const hasExpectedFormat = expectedHeaders.every((header) => headers.includes(header));

      if (!hasExpectedFormat) {
        showMessage("El formato del archivo no es el esperado", "error");
        return;
      }

      processExcelData();
      updateStepIndicator(2);
    } catch (error) {
      console.error("Error al procesar el archivo:", error);
      showMessage("Error al procesar el archivo. Asegúrese de que sea un archivo Excel válido.", "error");
    }
  };

  reader.readAsArrayBuffer(file);
}

// ---------------------------
// Procesar datos de Excel para llenar dropdowns
// ---------------------------
function processExcelData() {
  if (excelData.length < 2) return;

  const headers = excelData[0];
  const moduleIndex = headers.indexOf("Módulo");
  const teacherIndex = headers.indexOf("Docente");

  if (moduleIndex === -1 || teacherIndex === -1) {
    showMessage("No se encontraron las columnas de Módulo o Docente", "error");
    return;
  }

  const uniqueModules = new Set();
  const uniqueTeachers = new Set();

  for (let i = 1; i < excelData.length; i++) {
    const row = excelData[i];
    if (row[moduleIndex] && row[teacherIndex]) {
      uniqueModules.add(row[moduleIndex]);
      uniqueTeachers.add(row[teacherIndex]);
    }
  }

  populateDropdown(moduleSelect, Array.from(uniqueModules).sort());
  populateDropdown(teacherSelect, Array.from(uniqueTeachers).sort());

  moduleSelect.disabled = false;
  teacherSelect.disabled = false;

  showMessage(
    '<i class="fas fa-check-circle"></i> Archivo procesado correctamente. Seleccione un módulo y un docente.',
    "success"
  );
}

// ---------------------------
// Llenar dropdown dado un array de opciones
// ---------------------------
function populateDropdown(selectElement, options) {
  while (selectElement.options.length > 1) {
    selectElement.remove(1);
  }
  options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option;
    optionElement.textContent = option;
    selectElement.appendChild(optionElement);
  });
}

// ---------------------------
// Cambio de módulo seleccionado
// ---------------------------
function handleModuleChange() {
  selectedModule = moduleSelect.value;
  updateResults();
}

// ---------------------------
// Cambio de docente seleccionado
// ---------------------------
function handleTeacherChange() {
  selectedTeacher = teacherSelect.value;
  updateResults();
}

// ---------------------------
// Actualizar resultados de la tabla según módulo y docente
// ---------------------------
function updateResults() {
  if (!selectedModule || !selectedTeacher) {
    resultsSection.classList.add("hidden");
    microdisenoSection.classList.add("hidden");
    submitSection.classList.add("hidden");
    return;
  }

  const headers = excelData[0];
  const moduleIndex = headers.indexOf("Módulo");
  const teacherIndex = headers.indexOf("Docente");

  const filteredData = excelData
    .slice(1)
    .filter((row) => row[moduleIndex] === selectedModule && row[teacherIndex] === selectedTeacher);

  resultsBody.innerHTML = "";

  if (filteredData.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No se encontraron resultados para esta combinación de módulo y docente.";
    cell.style.textAlign = "center";
    row.appendChild(cell);
    resultsBody.appendChild(row);
  } else {
    filteredData.forEach((rowData) => {
      const row = document.createElement("tr");

      for (let i = 0; i < 6; i++) {
        const cell = document.createElement("td");
        let cellValue = rowData[i] || "";

        const columnName = headers[i];
        if (columnName === "Fecha de Clase" || columnName === "Fecha Ingreso") {
          cellValue = formatExcelDate(cellValue);
        }

        cell.textContent = cellValue;
        row.appendChild(cell);
      }

      resultsBody.appendChild(row);
    });
  }

  resultsSection.classList.remove("hidden");
  microdisenoSection.classList.remove("hidden");
  submitSection.classList.remove("hidden");
  updateStepIndicator(3);
}

// ---------------------------
// Extraer texto de PDF usando pdf.js
// ---------------------------
async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str);
    fullText += strings.join(" ") + "\n\n";
  }
  return fullText;
}

// ---------------------------
// Manejar subida de archivo de microdiseño (PDF)
// ---------------------------
async function handleMicrodisenoUpload(event) {
  event.preventDefault();
  const file = event.target.files[0];
  if (!file) return;

  microdisenoFile = file;
  microdisenoFileName.textContent = file.name;
  microdisenoUploaded = true;
  updateSubmitButton();
  updateStepIndicator(4);

  // Podemos extraer texto aquí si queremos mostrarlo antes de enviar
  try {
    const texto = await extractPdfText(file);
    // Si deseas mostrar el texto extraído en algún lugar, lo haces aquí
  } catch (err) {
    console.error("Error al extraer texto del PDF:", err);
  }
}

// ---------------------------
// Habilitar o deshabilitar botón de envío de reporte (microdiseño)
// ---------------------------
function updateSubmitButton() {
  submitButton.disabled = !(selectedModule && selectedTeacher && microdisenoUploaded);
  if (!submitButton.disabled) {
    updateStepIndicator(5);
  }
}

// ---------------------------
// Enviar reporte (microdiseño) a Make
// ---------------------------
async function submitReport() {
  if (!selectedModule || !selectedTeacher) {
    showMessage(
      '<i class="fas fa-exclamation-triangle"></i> Debe seleccionar un módulo y un docente',
      "error"
    );
    return;
  }
  if (!microdisenoFile) {
    showMessage(
      '<i class="fas fa-exclamation-triangle"></i> Debe subir el archivo de microdiseño',
      "error"
    );
    return;
  }

  showMessage('<i class="fas fa-spinner fa-spin"></i> Procesando y enviando reporte...', "success");

  try {
    const textoExtraido = await extractPdfText(microdisenoFile);
    console.log("Texto extraído del PDF:", textoExtraido);

    const payload = {
      modulo: selectedModule,
      docente: selectedTeacher,
      sessionToken: sessionToken,
      microdiseno: {
        nombre: microdisenoFile.name,
        tipo: microdisenoFile.type,
        contenido: textoExtraido,
      },
    };

    const res = await fetch("https://hook.us2.make.com/y1tdc65uhvgp5o5plum5bw10or62dld9", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Error en la respuesta del servidor");

    await res.text();
    showMessage('<i class="fas fa-check-circle"></i> Reporte enviado correctamente', "success");
    steps.forEach((s) => {
      s.classList.add("completed");
      s.classList.remove("active");
    });
  } catch (err) {
    console.error("Error en submitReport:", err);
    showMessage(
      '<i class="fas fa-exclamation-circle"></i> Error al enviar el reporte: ' + err.message,
      "error"
    );
  }
}

// ---------------------------
// Manejar datos recibidos por el webhook
// ---------------------------
function handleWebhookData(data) {
  webhookData = data;

  notificationCount++;
  notificationBadge.textContent = notificationCount;
  notificationBadge.classList.remove("hidden");

  displayWebhookData(data);
  webhookResults.classList.remove("hidden");

  // Mostrar sección de coherencia (antes estaba oculta)
  coherenciaSection.classList.remove("hidden");

  showMessage('<i class="fas fa-bell"></i> Nuevos datos recibidos por webhook', "success");
}

// ---------------------------
// Mostrar los datos del webhook en la tabla, con un <select> para cada fila
// ---------------------------
function displayWebhookData(data) {
  webhookTableBody.innerHTML = "";

  // Para cada grupo (groupId)
  for (const groupId in data) {
    const groupData = data[groupId];

    groupData.forEach((entry, index) => {
      const row = document.createElement("tr");

      // Aplicar clase según el estado de éxito (solo para colorear de fondo)
      if (entry.success) {
        row.classList.add("success-row");
      } else {
        row.classList.add("error-row");
      }

      // Columna: Grupo (groupId)
      const groupCell = document.createElement("td");
      groupCell.textContent = groupId;
      row.appendChild(groupCell);

      // Columna: Fecha de Clase
      const dateCell = document.createElement("td");
      dateCell.textContent = entry.dateOfClass || "";
      row.appendChild(dateCell);

      // Columna: Tema Dado
      const temaDadoCell = document.createElement("td");
      temaDadoCell.textContent = entry.temaDado || "";
      row.appendChild(temaDadoCell);

      // Columna: Tema Esperado
      const temaEsperadoCell = document.createElement("td");
      temaEsperadoCell.textContent = entry.temaEsperado || "";
      row.appendChild(temaEsperadoCell);

      // Columna: Semana
      const weekCell = document.createElement("td");
      weekCell.textContent = entry.week || "";
      row.appendChild(weekCell);

      // Columna: Selección Coherencia (un <select> con opciones: “Seleccionar”, “Coherente”, “Incoherente”)
      const selectCell = document.createElement("td");
      const select = document.createElement("select");
      select.dataset.groupId = groupId; // para luego identificar el groupId
      select.dataset.index = index; // si necesitas index de la sublista (no siempre es necesario, pero queda para referencia)
      // Opción por defecto
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Seleccionar...";
      select.appendChild(defaultOption);
      // Coherente
      const coherentOption = document.createElement("option");
      coherentOption.value = "coherente";
      coherentOption.textContent = "Coherente";
      select.appendChild(coherentOption);
      // Incoherente
      const incoherentOption = document.createElement("option");
      incoherentOption.value = "incoherente";
      incoherentOption.textContent = "Incoherente";
      select.appendChild(incoherentOption);
      selectCell.appendChild(select);
      row.appendChild(selectCell);

      webhookTableBody.appendChild(row);
    });
  }
}

// ---------------------------
// Función que se ejecuta cuando el usuario hace clic en “Subir reporte”
// Recopila todas las filas con selección y envía un JSON único al webhook de Make
// ---------------------------
async function enviarReporteCoherencia() {
  // Recorrer todas las filas de la tabla y tomar aquellas que tengan algo seleccionado
  const filas = webhookTableBody.querySelectorAll("tr");
  const reporteArray = [];

  filas.forEach((row) => {
    const cells = row.querySelectorAll("td");
    // cell[0] = groupId, cell[1]=dateOfClass, cell[2]=temaDado, cell[3]=temaEsperado, cell[4]=week, cell[5]=select
    const groupId = cells[0].textContent;
    const dateOfClass = cells[1].textContent;
    const temaDado = cells[2].textContent;
    const temaEsperado = cells[3].textContent;
    const week = cells[4].textContent;
    const select = cells[5].querySelector("select");
    const seleccion = select.value; // “coherente” / “incoherente” / “”

    if (seleccion === "coherente" || seleccion === "incoherente") {
      // Encontramos el entry original en webhookData para armar el objeto completo
      // webhookData tiene la forma { groupId1: [ {...}, {...} ], groupId2: [ {...} ] }
      // Buscamos en webhookData[groupId] el entry que coincida con dateOfClass y temaDado
      const entradasGrupo = webhookData[groupId] || [];
      const entryOriginal = entradasGrupo.find(
        (e) =>
          e.dateOfClass === dateOfClass &&
          e.temaDado === temaDado &&
          e.temaEsperado === temaEsperado &&
          e.week === week
      );

      if (entryOriginal) {
        // Armamos un objeto combinando entryOriginal más la selección
        const objAEnviar = {
          ...entryOriginal,
          groupId: groupId,
          coherence: seleccion === "coherente" ? false : true, // false = coherente, true = incoherente (igual que antes)
          modulo: selectedModule,
          docente: selectedTeacher,
          sessionToken: sessionToken,
        };
        reporteArray.push(objAEnviar);
      }
    }
  });

  if (reporteArray.length === 0) {
    showMessage('<i class="fas fa-exclamation-triangle"></i> No hay selecciones para enviar.', "error");
    return;
  }

  // Mostrar mensaje de carga
  showMessage('<i class="fas fa-spinner fa-spin"></i> Enviando reporte de coherencia...', "success");

  try {
    const postUrl = "https://hook.us2.make.com/qefil1n1twwp97kczuuw4ugbvn6sr2es";
    const res = await fetch(postUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reporteArray),
    });
    if (!res.ok) throw new Error("Error en la respuesta del servidor al enviar coherencia");

    await res.text();
    showMessage('<i class="fas fa-check-circle"></i> Reporte de coherencia enviado correctamente.', "success");

    // Opción: limpiar la tabla o deshabilitar la sección después de enviar
    webhookTableBody.innerHTML = "";
    coherenciaSection.classList.add("hidden");
  } catch (error) {
    console.error("Error al enviar el reporte de coherencia:", error);
    showMessage(
      '<i class="fas fa-exclamation-circle"></i> Error al enviar el reporte de coherencia: ' +
        error.message,
      "error"
    );
  }
}

// ---------------------------
// Mostrar modal con texto completo (para PDFs, si lo necesitas)
// ---------------------------
function showTextModal(title, text) {
  modalTitle.textContent = title;
  modalBody.textContent = text;
  textModal.style.display = "block";
}

// ---------------------------
// Cerrar modal
// ---------------------------
function closeModal() {
  textModal.style.display = "none";
}

// ---------------------------
// Copiar URL del webhook al portapapeles
// ---------------------------
function copyWebhookUrl() {
  const webhookUrl = document.getElementById("webhookUrl");
  navigator.clipboard
    .writeText(webhookUrl.textContent)
    .then(() => {
      copyUrlBtn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => {
        copyUrlBtn.innerHTML = '<i class="fas fa-copy"></i>';
      }, 2000);
    })
    .catch((err) => {
      console.error("Error al copiar: ", err);
    });
}

// ---------------------------
// Limpiar la conexión SSE cuando se cierra la página
// ---------------------------
window.addEventListener("beforeunload", () => {
  if (eventSource) {
    eventSource.close();
  }
});
