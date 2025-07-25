// Variables globales
// Al principio de tu script (junto a las demás variables globales)
let pendingActions = [];
let excelData = [];
let selectedModule = "";
let selectedTeacher = "";
let microdisenoUploaded = false;
let currentStep = 1;
let webhookData = null;
let notificationCount = 0;
let eventSource = null;
// Añadir una variable global para almacenar el archivo de microdiseño
let microdisenoFile = null;
let sessionToken = null;

// Para reenviar a Make SOLO UNA VEZ

// Usuarios válidos para la credencial
const validUsers = ["Valeria", "Marlene", "Juliana", "Cristian"];

// PEDIR TOKEN AL USUARIO ANTES DE CARGAR LA PÁGINA
// Mostrar el modal al cargar
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("tokenModal").style.display = "flex";
});

// Al hacer clic en Entrar
document.getElementById("tokenSubmit").addEventListener("click", () => {
  const input = document.getElementById("tokenInput").value.trim();
  if (!validUsers.includes(input)) {
    alert("Credencial inválida. Use: " + validUsers.join(", "));
    return;
  }
  sessionToken = input;
  // ocultar modal y continuar
  document.getElementById("tokenModal").style.display = "none";
  initWebhookConnection();
});

// Elementos del DOM
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

// Elementos del modal de texto (para mostrar observaciones completas, etc.)
const textModal = document.getElementById("textModal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const closeModalButton = document.getElementById("closeModalButton");
const closeModalX = document.querySelector(".close-modal");

// Event Listeners
excelFileInput.addEventListener("change", handleExcelUpload);
moduleSelect.addEventListener("change", handleModuleChange);
teacherSelect.addEventListener("change", handleTeacherChange);
microdisenoFileElement.addEventListener("change", handleMicrodisenoUpload);
submitButton.addEventListener("click", submitReport);
closeModalButton.addEventListener("click", closeModal);
closeModalX.addEventListener("click", closeModal);
copyUrlBtn.addEventListener("click", copyWebhookUrl);

// Función para inicializar la conexión del webhook usando Server-Sent Events (SSE)
function initWebhookConnection() {
  if (!sessionToken) {
    console.error("No se proporcionó ningún token de sesión.");
    statusDot.classList.remove("online");
    statusDot.classList.add("offline");
    statusText.textContent = "Token no válido";
    return;
  }

  // URL del servidor de webhook
  const serverUrl = "https://proyectousa.onrender.com";

  try {
    // Crear una conexión SSE con el token de sesión proporcionado por el usuario
    eventSource = new EventSource(
      `${serverUrl}/events?token=${encodeURIComponent(sessionToken)}`
    );

    // Manejar el evento de conexión abierta
    eventSource.onopen = () => {
      console.log("Conexión SSE establecida");
      statusDot.classList.remove("offline");
      statusDot.classList.add("online");
      statusText.textContent = "Webhook conectado";
    };

    // Manejar el evento de mensaje recibido
    eventSource.addEventListener("webhook-data", (event) => {
      try {
        // 1) Limpiamos fetos de Markdown:
        let raw = event.data;
        // console.log("Datos recibidos del webhook:", raw);
        raw = raw.replace(/```json/g, "").replace(/```/g, "");

        // 2) Parseamos el JSON limpio
        const data = JSON.parse(raw);

        handleWebhookData(data);
      } catch (error) {
        console.error("Error al procesar los datos del webhook:", error);
      }
    });

    // Manejar errores de conexión
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

    // Para fines de demostración, simular la recepción de datos después de 5 segundos
    setTimeout(simulateWebhookData, 5000);
  }
}

function formatExcelDate(excelDate) {
  if (!excelDate || isNaN(excelDate)) return excelDate;

  // Excel cuenta los días desde el 1 de enero de 1900
  const excelStartDate = new Date(1900, 0, 1);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const actualDate = new Date(
    excelStartDate.getTime() + (excelDate - 2) * millisecondsPerDay
  );

  // Formatear como DD/MM/YYYY
  const day = actualDate.getDate().toString().padStart(2, "0");
  const month = (actualDate.getMonth() + 1).toString().padStart(2, "0");
  const year = actualDate.getFullYear();

  return `${day}/${month}/${year}`;
}

function formatExcelTime(excelTime) {
  if (!excelTime || isNaN(excelTime)) return excelTime;

  // Excel almacena las horas como fracciones de día
  const totalMinutes = Math.round(excelTime * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.n
    .toString().padStart(2, "0")}`;
}

// Función para simular la recepción de datos (solo para demostración)
function simulateWebhookData() {
  // Datos de ejemplo
  const exampleData = {
    "DERE0042-R02": [
      {
        temaDado:
          "Presentación del Micro currículo, socialización Tema: Introducción a la Historia de la Filosofía del Derecho Concepto – utilidad- objeto -relación con otras ciencias",
        temaEsperado:
          "Bienvenida al curso y presentación de la clase y presentación del contenido programático",
        success: true,
        week: "02/06/2025 - 02/07/2025",
        dateOfClass: "2/6/2025",
        observations: "None",
      },
      {
        temaDado: "Concepto de Filosofía del Derecho",
        temaEsperado: "Concepto de Filosofía del Derecho",
        success: true,
        week: "02/13/2025 - 02/14/2025",
        dateOfClass: "2/13/2025",
        observations: "None",
      },
    ],
    "DERE0042-R03": [
      {
        temaDado: "Introducción a la materia",
        temaEsperado: "Presentación del curso y metodología",
        success: false,
        week: "02/06/2025 - 02/07/2025",
        dateOfClass: "2/7/2025",
        observations: "None",
      },
    ],
  };

  // Procesar los datos simulados
  handleWebhookData(exampleData);

  // Cambiar el estado a conectado
  statusDot.classList.remove("offline");
  statusDot.classList.add("online");
  statusText.textContent = "Webhook conectado (simulado)";
}

// Función para manejar los datos recibidos por el webhook
function handleWebhookData(data) {
  webhookData = data;

  // Incrementar contador de notificaciones
  notificationCount++;
  notificationBadge.textContent = notificationCount;
  notificationBadge.classList.remove("hidden");

  // Mostrar los datos en la tabla
  displayWebhookData(data);

  // Mostrar la sección de resultados
  webhookResults.classList.remove("hidden");

  // Mostrar mensaje de notificación
  showMessage('<i class="fas fa-bell"></i> Nuevos datos recibidos por webhook', "success");
}

// Función para actualizar el indicador de pasos
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

// Función para manejar la carga del archivo Excel
function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  excelFileName.textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      // XLSX ya está disponible globalmente desde el script en el HTML
      const workbook = XLSX.read(data, { type: "array" });

      // Asumimos que los datos están en la primera hoja
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Convertir a JSON
      excelData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Verificar si hay datos y si tienen el formato esperado
      if (excelData.length < 2) {
        showMessage("El archivo no contiene datos suficientes", "error");
        return;
      }

      // Asumimos que la primera fila son los encabezados
      const headers = excelData[0];

      // Verificar si los encabezados son los esperados
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
      const hasExpectedFormat = expectedHeaders.every((header) =>
        headers.includes(header)
      );

      if (!hasExpectedFormat) {
        showMessage("El formato del archivo no es el esperado", "error");
        return;
      }

      // Procesar los datos para obtener módulos y docentes únicos
      processExcelData();

      // Actualizar el indicador de pasos
      updateStepIndicator(2);
    } catch (error) {
      console.error("Error al procesar el archivo:", error);
      showMessage(
        "Error al procesar el archivo. Asegúrese de que sea un archivo Excel válido.",
        "error"
      );
    }
  };

  reader.readAsArrayBuffer(file);
}

// Función para procesar los datos del Excel
function processExcelData() {
  if (excelData.length < 2) return;

  const headers = excelData[0];
  const moduleIndex = headers.indexOf("Módulo");
  const teacherIndex = headers.indexOf("Docente");

  if (moduleIndex === -1 || teacherIndex === -1) {
    showMessage("No se encontraron las columnas de Módulo o Docente", "error");
    return;
  }

  // Obtener módulos y docentes únicos
  const uniqueModules = new Set();
  const uniqueTeachers = new Set();

  for (let i = 1; i < excelData.length; i++) {
    const row = excelData[i];
    if (row[moduleIndex] && row[teacherIndex]) {
      uniqueModules.add(row[moduleIndex]);
      uniqueTeachers.add(row[teacherIndex]);
    }
  }

  // Llenar los dropdowns
  populateDropdown(moduleSelect, Array.from(uniqueModules).sort());
  populateDropdown(teacherSelect, Array.from(uniqueTeachers).sort());

  // Habilitar los dropdowns
  moduleSelect.disabled = false;
  teacherSelect.disabled = false;

  showMessage(
    '<i class="fas fa-check-circle"></i> Archivo procesado correctamente. Seleccione un módulo y un docente.',
    "success"
  );
}

// Función para llenar un dropdown
function populateDropdown(selectElement, options) {
  // Limpiar opciones existentes excepto la primera
  while (selectElement.options.length > 1) {
    selectElement.remove(1);
  }

  // Agregar nuevas opciones
  options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option;
    optionElement.textContent = option;
    selectElement.appendChild(optionElement);
  });
}

// Función para manejar el cambio de módulo
function handleModuleChange() {
  selectedModule = moduleSelect.value;
  updateResults();
}

// Función para manejar el cambio de docente
function handleTeacherChange() {
  selectedTeacher = teacherSelect.value;
  updateResults();
}

// Función para actualizar los resultados
function updateResults() {
  if (!selectedModule || !selectedTeacher) {
    resultsSection.classList.add("hidden");
    microdisenoSection.classList.add("hidden");
    submitSection.classList.add("hidden");
    return;
  }

  // Filtrar datos según el módulo y docente seleccionados
  const headers = excelData[0];
  const moduleIndex = headers.indexOf("Módulo");
  const teacherIndex = headers.indexOf("Docente");

  const filteredData = excelData
    .slice(1)
    .filter(
      (row) =>
        row[moduleIndex] === selectedModule && row[teacherIndex] === selectedTeacher
    );

  // Mostrar resultados
  resultsBody.innerHTML = "";

  if (filteredData.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6; // Cambiado a 6 columnas (eliminamos las 2 últimas)
    cell.textContent =
      "No se encontraron resultados para esta combinación de módulo y docente.";
    cell.style.textAlign = "center";
    row.appendChild(cell);
    resultsBody.appendChild(row);
  } else {
    filteredData.forEach((rowData) => {
      const row = document.createElement("tr");

      // Solo mostrar las primeras 6 columnas (eliminamos Hrs. Clase y Hora Ingreso)
      for (let i = 0; i < 6; i++) {
        const cell = document.createElement("td");
        let cellValue = rowData[i] || "";

        // Formatear fechas según la columna
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

  // Mostrar secciones
  resultsSection.classList.remove("hidden");
  microdisenoSection.classList.remove("hidden");
  submitSection.classList.remove("hidden");

  // Actualizar el indicador de pasos
  updateStepIndicator(3);
}

// —————————————————————————————————————————
// Función para extraer texto de .docx con Mammoth.js
// Asegúrate de haber incluido en tu HTML:
// <script src="https://unpkg.com/mammoth/mammoth.browser.min.js"></script>
async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value; // Texto plano extraído
}

// Función para extraer texto de .pdf con pdfjsLib
// Asegúrate de haber incluido en tu HTML:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.min.js"></script>
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

// Función para manejar la carga del archivo de microdiseño (.pdf o .docx)
async function handleMicrodisenoUpload(event) {
  event.preventDefault();
  const file = event.target.files[0];
  if (!file) return;
  webhookTableBody.innerHTML = "";

  microdisenoFile = file;
  microdisenoFileName.textContent = file.name;
  microdisenoUploaded = true;
  updateSubmitButton();
  updateStepIndicator(4);

  // Extraemos y mostramos el texto en consola (o en un modal si prefieres)
  try {
    let texto;
    if (file.type === "application/pdf") {
      texto = await extractPdfText(file);
    } else if (
      file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx")
    ) {
      texto = await extractDocxText(file);
    } else {
      showMessage(
        '<i class="fas fa-exclamation-circle"></i> Formato no soportado. Use PDF o DOCX.',
        "error"
      );
      microdisenoUploaded = false;
      microdisenoFile = null;
      microdisenoFileName.textContent = "";
      microdisenoFileElement.value = "";
      return;
    }
    // console.log("Texto extraído:", texto);
    // Si deseas mostrarlo en un modal:
    // showTextModal("Vista previa del microdiseño", texto);
  } catch (err) {
    console.error("Error al extraer texto del archivo:", err);
    showMessage('<i class="fas fa-exclamation-circle"></i> Error al procesar el archivo', "error");
    microdisenoUploaded = false;
    microdisenoFile = null;
    microdisenoFileName.textContent = "";
    microdisenoFileElement.value = "";
  }
}

// Función para actualizar el estado del botón de envío
function updateSubmitButton() {
  submitButton.disabled = !(selectedModule && selectedTeacher && microdisenoUploaded);

  if (!submitButton.disabled) {
    updateStepIndicator(5);
  }
}

// Función para enviar el reporte (incluye texto extraído del .pdf o .docx)
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

  showMessage(
    '<i class="fas fa-spinner fa-spin"></i> Procesando y enviando reporte...',
    "success"
  );

  try {
    // Extraemos el texto del Word o PDF
    let textoExtraido;
    if (microdisenoFile.type === "application/pdf") {
      textoExtraido = await extractPdfText(microdisenoFile);
    } else {
      textoExtraido = await extractDocxText(microdisenoFile);
    }

    // console.log("Texto extraído para envío:", textoExtraido);

    // Preparamos el payload
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

    const res = await fetch(
      "https://hook.us2.make.com/y1tdc65uhvgp5o5plum5bw10or62dld9",
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) throw new Error("Error en la respuesta del servidor");

    await res.text();
    showMessage(
      '<i class="fas fa-check-circle"></i> Reporte enviado correctamente',
      "success"
    );

    // ---------- AQUÍ LIMPIAMOS EL ARCHIVO SUBIDO ----------
    microdisenoFile = null;
    microdisenoUploaded = false;
    microdisenoFileElement.value = ""; // borrar selección en el input
    microdisenoFileName.textContent = ""; // borrar nombre mostrado

    // Deshabilitar nuevamente el botón de envío hasta que suban otro archivo
    submitButton.disabled = true;

    // Mantener visible la sección, sin ocultarla
    updateStepIndicator(4);
  } catch (err) {
    console.error("Error en submitReport:", err);
    showMessage(
      '<i class="fas fa-exclamation-circle"></i> Error al enviar el reporte: ' +
      err.message,
      "error"
    );
  }
}

// Función para mostrar mensajes en pantalla
function showMessage(text, type) {
  messageDiv.innerHTML = text;
  messageDiv.className = "message " + type;
  messageDiv.classList.remove("hidden");

  // Ocultar el mensaje después de 5 segundos si es un mensaje de éxito
  if (type === "success") {
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }
}

// Función auxiliar: parsear "DD/MM/YYYY" a Date
function parseDMY(str) {
  const parts = str.split("/").map((p) => parseInt(p, 10));
  // parts = [día, mes, año]
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

let needsAlert = false;
// Función para reenviar a Make si existe alguna semana con fecha final < 31/05/2025

let id = "03/02/2025";
// Función para mostrar los datos del webhook en la tabla
function displayWebhookData(data) {
  webhookTableBody.innerHTML = "";

  // 1) Verificar y reenviar si corresponde (solo una vez)

  // 2) Construir filas. También, detectar si hay celdas a resaltar

  for (const groupId in data) {
    const groupData = data[groupId];

    groupData.forEach((entry) => {
      const row = document.createElement("tr");

      // Aplicar clase según el estado de éxito
      if (entry.success) {
        row.classList.add("success-row");
      } else {
        row.classList.add("error-row");
      }

      // CELDA 1: Grupo
      const groupCell = document.createElement("td");
      groupCell.textContent = groupId;
      row.appendChild(groupCell);

      // CELDA 2: Fecha de Clase
      const dateCell = document.createElement("td");
      let dateClass = entry.dateOfClass;
      let aux = dateClass.split("/");
      dateClass = aux[1]+"/"+aux[0]+"/"+aux[2];
      dateCell.textContent = dateClass || "";
      row.appendChild(dateCell);

      // CELDA 3: Tema Dado
      const temaDadoCell = document.createElement("td");
      temaDadoCell.textContent = entry.temaDado || "";
      row.appendChild(temaDadoCell);

      // CELDA 4: Tema Esperado
      const temaEsperadoCell = document.createElement("td");
      temaEsperadoCell.textContent = entry.temaEsperado || "";
      row.appendChild(temaEsperadoCell);

      // CELDA 5: Semana
      const weekCell = document.createElement("td");
      
      if(entry.week){
        weekCell.textContent = id +" --- " + entry.week;
      }else{
        needsAlert = true;
      }
      
       id  = entry.week
      // Si el formato es "DD/MM/YYYY - DD/MM/YYYY", evaluamos la segunda fecha

      row.appendChild(weekCell);

      // CELDA 6: Acciones (botones)
      const actionsCell = document.createElement("td");
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "action-buttons";

      // Botón de Coherente
      const coherentBtn = document.createElement("button");
      coherentBtn.className = "btn-check";
      coherentBtn.innerHTML = '<i class="fas fa-check"></i> Coherente';
      coherentBtn.onclick = () => {
        addActionAndMaybeSend(groupId, entry, "x", "", "");
        row.remove();
      };
      actionsDiv.appendChild(coherentBtn);

      // Botón de Incoherente
      const incoherentBtn = document.createElement("button");
      incoherentBtn.className = "btn-x";
      incoherentBtn.innerHTML = '<i class="fas fa-times"></i> Incoherente';
      incoherentBtn.onclick = () => {
        addActionAndMaybeSend(groupId, entry, "", "x", `el tema dado ${entry.temaDado || "(Vacío)"
          } NO es coherente con el tema esperado ${entry.temaEsperado || "sin tema esperado"}`);
        row.remove();
      };
      actionsDiv.appendChild(incoherentBtn);

      actionsCell.appendChild(actionsDiv);
      row.appendChild(actionsCell);

      // Agregar la fila a la tabla
      webhookTableBody.appendChild(row);
    });
  }

  // 3) Si hubo alguna semana inválida (< 31/05/2025), mostrar alerta
  if (needsAlert) {
    alert("Por favor, se recomienda que vuelva a hacer el proceso. Si el problema persiste confirme las fechas manualmente, pues según el microdiseño no se registran clases en las semana final (25 de Mayo a 31 de Mayo).");
    needsAlert = false; // Reiniciar la bandera para futuros envíos
    
  }
}

// Función para enviar la solicitud de acción (Coherente/Incoherente)
function addActionAndMaybeSend(groupId, entry, obser1, obser2, color) {
  // Empuja al array de pendientes
  pendingActions.push({
    modulo: selectedModule,
    groupId,
    docente: selectedTeacher,
    fechaClase: entry.dateOfClass.toString(),
    obser1: obser1,
    obser2: obser2,
    obser3: color,

  });

  // Elimina la fila (esto ya lo hacías)
  // ... (tu código para row.remove())

  // Si ya no quedan filas en la tabla, envía el lote
  const rowsLeft = webhookTableBody.querySelectorAll("tr").length;
  console.log("Filas restantes:", rowsLeft);
  if (rowsLeft === 1) {
    console.log("Buffer de acciones pendiente:", pendingActions);
    sendBatchActions();
  }
}

async function sendBatchActions() {
  if (pendingActions.length === 0) return;

  showMessage(
    '<i class="fas fa-spinner fa-spin"></i> Enviando lote de acciones...',
    "success"
  );

  try {
    pendingActions = {
      actions: pendingActions,
    }
    const res = await fetch(
      "https://hook.us2.make.com/qefil1n1twwp97kczuuw4ugbvn6sr2es",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "sessionToken": sessionToken },
        body: JSON.stringify(pendingActions),
      }
    );
    if (!res.ok) throw new Error("Error en la respuesta del servidor");

    await res.text();
    showMessage(
      `<i class="fas fa-check-circle"></i> Todas las acciones enviadas correctamente`,
      "success"
    );
    // Vacía el array para la próxima vez
    pendingActions = [];
  } catch (err) {
    console.error("Error al enviar lote de acciones:", err);
    showMessage(
      '<i class="fas fa-exclamation-circle"></i> Error al enviar lote: ' + err.message,
      "error"
    );
  }
}


// Función para mostrar el modal con texto completo (observaciones, etc.)
function showTextModal(title, text) {
  modalTitle.textContent = title;
  modalBody.textContent = text;
  textModal.style.display = "block";
}

// Función para cerrar el modal
function closeModal() {
  textModal.style.display = "none";
}

// Función para copiar la URL del webhook
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

// Cerrar el modal si se hace clic fuera de él
window.onclick = (event) => {
  if (event.target === textModal) {
    closeModal();
  }
};

// Limpiar la conexión SSE cuando se cierra la página
window.addEventListener("beforeunload", () => {
  if (eventSource) {
    eventSource.close();
  }
});

// Inicializar el indicador de pasos
updateStepIndicator(1);
