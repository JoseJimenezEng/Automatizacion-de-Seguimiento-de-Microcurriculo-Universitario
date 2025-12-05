// Variables globales
let excelData = []
let selectedModule = ""
let selectedTeacher = ""
let microdisenoFile = null
let microdisenoUploaded = false
let sessionToken = ""
let coherenciaSelections = {} // Agregar variable global para rastrear selecciones
let webhookData = null // Agregar variable global para almacenar datos del webhook
let iaActivada = false // Variable global para el estado del toggle de IA

// Elementos del DOM
let excelFileElement
let excelFileName
let moduleSelect
let teacherSelect
let resultsSection
let resultsBody
let microdisenoSection
let microdisenoFileElement
let microdisenoFileName
let submitSection
let submitButton
let messageDiv
let tokenModal
let tokenInput
let tokenSubmit
let finalSubmitContainer // Variable para el contenedor del botón final
let iaToggle // Variable para el toggle de IA
let iaToggleText // Variable para el texto del toggle de IA

// Librerías necesarias
// const XLSX = require("xlsx")
// const pdfjsLib = require("pdfjs-dist")
// const mammoth = require("mammoth")

// Función para escapar comillas simples en cadenas
function escapeQuotes(str) {
  return str.replace(/'/g, "\\'")
}

function clearAllColumns() {
  const comparisonSection = document.getElementById("comparisonSection")
  if (comparisonSection) {
    comparisonSection.remove()
  }

  coherenciaSelections = {}
  finalSubmitContainer = null
}

// Inicialización cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  // Obtener referencias a elementos del DOM
  excelFileElement = document.getElementById("excelFile")
  excelFileName = document.getElementById("excelFileName")
  moduleSelect = document.getElementById("moduleSelect")
  teacherSelect = document.getElementById("teacherSelect")
  resultsSection = document.getElementById("resultsSection")
  resultsBody = document.getElementById("resultsBody")
  microdisenoSection = document.getElementById("microdisenoSection")
  microdisenoFileElement = document.getElementById("microdisenoFile")
  microdisenoFileName = document.getElementById("microdisenoFileName")
  submitSection = document.getElementById("submitSection")
  submitButton = document.getElementById("submitButton")
  messageDiv = document.getElementById("message")
  tokenModal = document.getElementById("tokenModal")
  tokenInput = document.getElementById("tokenInput")
  tokenSubmit = document.getElementById("tokenSubmit")
  finalSubmitContainer = document.getElementById("finalSubmitContainer") // Obtener referencia al contenedor del botón final
  iaToggle = document.getElementById("iaToggle") // Obtener referencia al toggle de IA
  iaToggleText = document.getElementById("iaToggleText") // Obtener referencia al texto del toggle de IA

  // Event Listeners
  excelFileElement.addEventListener("change", handleExcelUpload)
  moduleSelect.addEventListener("change", handleModuleChange)
  teacherSelect.addEventListener("change", handleTeacherChange)
  microdisenoFileElement.addEventListener("change", handleMicrodisenoUpload)
  submitButton.addEventListener("click", submitReport) // Corregido el evento de escucha
  tokenSubmit.addEventListener("click", handleTokenSubmit)
  iaToggle.addEventListener("click", () => {
    iaActivada = !iaActivada
    iaToggle.setAttribute("data-active", iaActivada.toString())

    if (iaActivada) {
      iaToggleText.textContent = "IA Activada"
      // Cuando se activa, ejecutar clearAllColumns después de 1 segundo
      setTimeout(() => {
        clearAllColumns()
      }, 1000)
    } else {
      iaToggleText.textContent = "IA Desactivada"
    }

    console.log("[v0] IA Activada:", iaActivada)
  })

  // Mostrar modal de token al cargar
  tokenModal.style.display = "block"

  // Permitir presionar Enter en el input del token
  tokenInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleTokenSubmit()
    }
  })

  updateStepIndicator(1)
})

// Manejar el envío del token de sesión
function handleTokenSubmit() {
  const token = tokenInput.value.trim()
  if (!token) {
    alert("Por favor ingrese su usuario")
    return
  }

  // Validar usuarios permitidos
  const allowedUsers = ["Valeria", "Marlene", "Juliana", "Cristian", "Mariana", "Yolanda", "Yesika"]
  if (!allowedUsers.includes(token)) {
    alert("Usuario no permitido. Usuarios válidos: " + allowedUsers.join(", "))
    return
  }

  sessionToken = token
  tokenModal.style.display = "none"
  showMessage('<i class="fas fa-check-circle"></i> Sesión iniciada como ' + token, "success")
}

// Actualizar indicador de pasos
function updateStepIndicator(currentStep) {
  const steps = document.querySelectorAll(".step")
  steps.forEach((step, index) => {
    const stepNumber = index + 1
    step.classList.remove("active", "completed")

    if (stepNumber < currentStep) {
      step.classList.add("completed")
    } else if (stepNumber === currentStep) {
      step.classList.add("active")
    }
  })
}

// Manejar carga de archivo Excel
function handleExcelUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  excelFileName.textContent = file.name

  const reader = new FileReader()
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result)
    const workbook = window.XLSX.read(data, { type: "array" }) // Assuming XLSX is loaded via script tag
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    excelData = window.XLSX.utils.sheet_to_json(firstSheet) // Assuming XLSX is loaded via script tag

    populateDropdowns()
    updateStepIndicator(2)
  }
  reader.readAsArrayBuffer(file)
}

// Poblar los dropdowns con datos únicos
function populateDropdowns() {
  const modules = [...new Set(excelData.map((row) => row["Módulo"] || row["Modulo"]).filter(Boolean))]
  const teachers = [...new Set(excelData.map((row) => row["Docente"]).filter(Boolean))]

  moduleSelect.innerHTML = '<option value="">Seleccione un módulo</option>'
  modules.forEach((module) => {
    const option = document.createElement("option")
    option.value = module
    option.textContent = module
    moduleSelect.appendChild(option)
  })

  teacherSelect.innerHTML = '<option value="">Seleccione un docente</option>'
  teachers.forEach((teacher) => {
    const option = document.createElement("option")
    option.value = teacher
    option.textContent = teacher
    teacherSelect.appendChild(option)
  })

  moduleSelect.disabled = false
  teacherSelect.disabled = false
}

// Manejar cambio de módulo
function handleModuleChange() {
  selectedModule = moduleSelect.value
  updateResults()
}

// Manejar cambio de docente
function handleTeacherChange() {
  selectedTeacher = teacherSelect.value
  updateResults()
}

// Actualizar resultados filtrados
function updateResults() {
  if (!selectedModule || !selectedTeacher) return

  const filteredData = excelData.filter((row) => {
    const module = row["Módulo"] || row["Modulo"]
    const teacher = row["Docente"]
    return module === selectedModule && teacher === selectedTeacher
  })

  resultsBody.innerHTML = ""
  filteredData.forEach((row) => {
    const tr = document.createElement("tr")
    tr.innerHTML = `
      <td>${row["Módulo"] || row["Modulo"] || ""}</td>
      <td>${row["Grupo"] || ""}</td>
      <td>${row["Docente"] || ""}</td>
      <td>${formatExcelDate(row["Fecha de Clase"]) || ""}</td>
      <td>${row["Tema"] || ""}</td>
      <td>${formatExcelDate(row["Fecha Ingreso"]) || ""}</td>
    `
    resultsBody.appendChild(tr)
  })

  resultsSection.classList.remove("hidden")
  microdisenoSection.classList.remove("hidden")
  submitSection.classList.remove("hidden")
  updateStepIndicator(3)
}

// Formatear fechas de Excel
function formatExcelDate(excelDate) {
  if (!excelDate || isNaN(excelDate)) return excelDate

  // 1. Convert Excel date to Unix Timestamp (milliseconds)
  // 25569 is the offset of days between Excel (1900-01-01) and Unix (1970-01-01)
  // We subtract this to align the timelines.
  const date = new Date((excelDate - 25569) * 24 * 60 * 60 * 1000)

  // 2. Use UTC methods to ensure we stay on the exact calculated day
  // (prevents rolling back hours due to local timezones)
  const day = date.getUTCDate().toString().padStart(2, "0")
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0")
  const year = date.getUTCFullYear()

  console.log(`Formatted date for Excel date ${excelDate}: ${day}/${month}/${year}`)

  return `${day}/${month}/${year}`
}

// Extraer texto de archivo PDF
async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise // Assuming pdfjsLib is loaded via script tag
  let fullText = ""

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const strings = content.items.map((item) => item.str)
    fullText += strings.join(" ") + "\n\n"
  }

  return fullText
}

// Extraer texto de archivo DOCX
async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const result = await window.mammoth.extractRawText({ arrayBuffer }) // Assuming mammoth is loaded via script tag
  return result.value
}

// Manejar carga de microdiseño
async function handleMicrodisenoUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  microdisenoFile = file
  microdisenoFileName.textContent = file.name
  microdisenoUploaded = true
  updateSubmitButton()
  updateStepIndicator(4)
  setTimeout(() => {
    clearAllColumns()
  }, 1000)

  try {
    let texto
    if (file.type === "application/pdf") {
      texto = await extractPdfText(file)
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx")
    ) {
      texto = await extractDocxText(file)
    } else {
      showMessage('<i class="fas fa-exclamation-circle"></i> Formato no soportado. Use PDF o DOCX.', "error")
      microdisenoUploaded = false
      microdisenoFile = null
      microdisenoFileName.textContent = ""
      microdisenoFileElement.value = ""
      return
    }
  } catch (err) {
    console.error("Error al extraer texto del archivo:", err)
    showMessage('<i class="fas fa-exclamation-circle"></i> Error al procesar el archivo', "error")
    microdisenoUploaded = false
    microdisenoFile = null
    microdisenoFileName.textContent = ""
    microdisenoFileElement.value = ""
  }
}

// Actualizar estado del botón de envío
function updateSubmitButton() {
  submitButton.disabled = !(selectedModule && selectedTeacher && microdisenoUploaded)

  if (!submitButton.disabled) {
    updateStepIndicator(5)
  }
}

async function submitReport() {
  setTimeout(() => {
    clearAllColumns()
  }, 1000)

  if (!selectedModule || !selectedTeacher || !microdisenoFile) {
    showMessage('<i class="fas fa-exclamation-circle"></i> Por favor complete todos los pasos', "error")
    return
  }

  showMessage('<i class="fas fa-spinner fa-spin"></i> Enviando reporte y esperando respuesta...', "loading")

  try {
    // Extraer texto del microdiseño
    let textoExtraido
    if (microdisenoFile.type === "application/pdf") {
      textoExtraido = await extractPdfText(microdisenoFile)
    } else {
      textoExtraido = await extractDocxText(microdisenoFile)
    }

    // Preparar el payload exactamente como se especificó
    const payload = {
      modulo: selectedModule,
      docente: selectedTeacher,
      sessionToken: sessionToken,
      microdiseno: {
        nombre: microdisenoFile.name,
        tipo: microdisenoFile.type,
        contenido: textoExtraido,
      },
      iaActivada: iaActivada, // Agregado estado de IA al payload
    }

    // Enviar POST request al webhook
    const response = await fetch("https://hook.eu2.make.com/gaurg2exleqajrtl3jf5u4h558ejv2sy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Error del servidor: ${response.status}`)
    }

    webhookData = await response.json()

    console.log("Respuesta recibida del webhook:", webhookData)

    showMessage('<i class="fas fa-check-circle"></i> Reporte enviado y respuesta recibida correctamente', "success")

    createClassComparison(webhookData)

    // Limpiar el archivo de microdiseño
    microdisenoFile = null
    microdisenoUploaded = false
    microdisenoFileElement.value = ""
    microdisenoFileName.textContent = ""
    submitButton.disabled = true
  } catch (err) {
    if (!iaActivada) {
      console.error("Error al enviar el reporte:", err)
      showMessage('<i class="fas fa-exclamation-circle"></i> Error al enviar el reporte: ' + err.message, "error")
    }
  }
}

function createClassComparison(weeklyData) {
  coherenciaSelections = {}

  // Verificar si ya existe la sección, si no crearla
  let comparisonSection = document.getElementById("comparisonSection")

  if (!comparisonSection) {
    comparisonSection = document.createElement("div")
    comparisonSection.id = "comparisonSection"
    comparisonSection.className = "section comparison-section"
    comparisonSection.innerHTML = `
      <h2 class="section-title">
        <i class="fas fa-clipboard-check"></i> Comparación de Clases
      </h2>
      <div id="comparisonContainer" class="comparison-container"></div>
    `
    submitSection.parentNode.insertBefore(comparisonSection, submitSection.nextSibling)
  }

  const container = document.getElementById("comparisonContainer")
  container.innerHTML = ""

  // Filtrar datos del Excel por módulo y docente seleccionados
  const filteredData = excelData.filter((row) => {
    const module = row["Módulo"] || row["Modulo"]
    const teacher = row["Docente"]
    return module === selectedModule && teacher === selectedTeacher
  })

  // Agrupar por grupo
  const groupedByGrupo = {}
  filteredData.forEach((row) => {
    const grupo = row["Grupo"]
    if (!groupedByGrupo[grupo]) {
      groupedByGrupo[grupo] = []
    }
    groupedByGrupo[grupo].push(row)
  })

  const weeklyArray = Object.entries(weeklyData)
    .sort((a, b) => {
      const numA = Number.parseInt(a[0].replace("Semana", ""))
      const numB = Number.parseInt(b[0].replace("Semana", ""))
      return numA - numB
    })
    .map(([key, value]) => ({
      semana: key,
      tema: value[0],
      fechaInicio: value[1],
      fechaFin: value[2],
    }))

  let totalRows = 0

  // Para cada grupo, crear una sección
  for (const [grupo, clases] of Object.entries(groupedByGrupo)) {
    // Ordenar clases por fecha
    const clasesOrdenadas = clases.sort((a, b) => {
      const fechaA = a["Fecha de Clase"]
      const fechaB = b["Fecha de Clase"]
      return fechaA - fechaB
    })

    const groupSection = document.createElement("div")
    groupSection.className = "group-section"
    groupSection.innerHTML = `
      <h3 class="group-title">
        <i class="fas fa-users"></i> Grupo: ${grupo}
      </h3>
      <div class="comparison-table-container">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Grupo</th>
              <th>Docente</th>
              <th>Tema Dado</th>
              <th>Tema Esperado</th>
              <th>Fecha Clase</th>
              <th>Fecha Estimada</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="comparison-body-${grupo}"></tbody>
        </table>
      </div>
    `
    container.appendChild(groupSection)

    const tbody = document.getElementById(`comparison-body-${grupo}`)

    // const usedWeeks = new Set() // Eliminado el Set de usedWeeks ya que ahora permitimos múltiples clases por semana

    clasesOrdenadas.forEach((clase, index) => {
      const fechaClase = formatExcelDate(clase["Fecha de Clase"])
      const temaDado = clase["Tema"] || ""
      const docente = clase["Docente"] || ""

      // const matchedWeek = findMatchingWeekByDate(fechaClase, weeklyArray, usedWeeks) // Pasamos null en lugar de usedWeeks para que no filtre semanas
      const matchedWeek = findMatchingWeekByDate(fechaClase, weeklyArray, null)

      let temaEsperado = ""
      let fechaEstimada = ""

      if (matchedWeek) {
        temaEsperado = matchedWeek.tema.replace("Tema:", "").trim()
        fechaEstimada = `${matchedWeek.fechaInicio} - ${matchedWeek.fechaFin}`
        // usedWeeks.add(matchedWeek.semana) // Ya no marcamos semanas como "usadas" para permitir múltiples asignaciones
      }

      const rowId = `row-${grupo}-${index}`
      totalRows++

      // Crear fila
      const row = document.createElement("tr")
      row.id = rowId
      row.innerHTML = `
        <td>${grupo}</td>
        <td>${docente}</td>
        <td class="tema-cell">${temaDado}</td>
        <td class="tema-cell">${temaEsperado}</td>
        <td>${fechaClase}</td>
        <td>${fechaEstimada}</td>
        <td>
          <div class="action-buttons-cell" data-row-id="${rowId}">
            <button class="btn-coherente" data-docente="${docente}" data-tema-dado="${temaDado}" data-tema-esperado="${temaEsperado}" data-grupo="${grupo}" data-asignatura="${selectedModule}" data-fecha-clase="${fechaClase}">
              <i class="fas fa-check"></i> Coherente
            </button>
            <button class="btn-no-coherente" data-docente="${docente}" data-tema-dado="${temaDado}" data-tema-esperado="${temaEsperado}" data-grupo="${grupo}" data-asignatura="${selectedModule}" data-fecha-clase="${fechaClase}">
              <i class="fas fa-times"></i> No Coherente
            </button>
          </div>
        </td>
      `
      tbody.appendChild(row)
    })
  }

  attachCoherenciaListeners()

  createFinalSubmitButton(totalRows)

  // Scroll suave hacia la sección de comparación
  comparisonSection.scrollIntoView({ behavior: "smooth", block: "start" })
}

function attachCoherenciaListeners() {
  const allButtons = document.querySelectorAll(".btn-coherente, .btn-no-coherente")

  allButtons.forEach((button) => {
    button.addEventListener("click", function (e) {
      e.preventDefault()

      const rowId = this.closest(".action-buttons-cell").dataset.rowId
      const isCoherente = this.classList.contains("btn-coherente")

      const docente = this.dataset.docente
      const temaDado = this.dataset.temaDado
      const temaEsperado = this.dataset.temaEsperado
      const grupo = this.dataset.grupo
      const asignatura = this.dataset.asignatura
      const fechaClase = this.dataset.fechaClase

      coherenciaSelections[rowId] = {
        docente,
        temaDado,
        temaEsperado,
        coherencia: isCoherente,
        grupo,
        asignatura,
        fechaClase,
      }

      const buttonsCell = this.closest(".action-buttons-cell")
      const row = document.getElementById(rowId)
      const coherenteBtn = buttonsCell.querySelector(".btn-coherente")
      const noCoherenteBtn = buttonsCell.querySelector(".btn-no-coherente")

      coherenteBtn.classList.remove("selected", "unselected")
      noCoherenteBtn.classList.remove("selected", "unselected")

      if (isCoherente) {
        coherenteBtn.classList.add("selected")
        noCoherenteBtn.classList.add("unselected")
      } else {
        noCoherenteBtn.classList.add("selected")
        coherenteBtn.classList.add("unselected")
      }

      row.classList.add("row-selected")

      checkAllSelectionsComplete()
    })
  })
}

function createFinalSubmitButton(totalRows) {
  if (!finalSubmitContainer) {
    finalSubmitContainer = document.createElement("div")
    finalSubmitContainer.id = "finalSubmitContainer"
    finalSubmitContainer.className = "final-submit-container"
    finalSubmitContainer.innerHTML = `
      <button id="finalSubmitBtn" class="btn-final-submit" disabled>
        <i class="fas fa-paper-plane"></i> Enviar Todas las Evaluaciones
      </button>
      <p class="selections-counter">
        <span id="selectionsCount">0</span> / <span id="totalCount">${totalRows}</span> selecciones completadas
      </p>
    `

    const comparisonSection = document.getElementById("comparisonSection")
    comparisonSection.appendChild(finalSubmitContainer)
  } else {
    document.getElementById("totalCount").textContent = totalRows
    document.getElementById("selectionsCount").textContent = 0
  }

  const finalBtn = document.getElementById("finalSubmitBtn")
  finalBtn.addEventListener("click", submitAllCoherencias)
}

function checkAllSelectionsComplete() {
  const totalRows = document.querySelectorAll(".comparison-table tbody tr").length
  const selectedCount = Object.keys(coherenciaSelections).length

  document.getElementById("selectionsCount").textContent = selectedCount

  const finalBtn = document.getElementById("finalSubmitBtn")
  if (totalRows === 0) {
    finalBtn.disabled = true
    finalBtn.classList.remove("enabled")
  } else if (selectedCount === totalRows) {
    finalBtn.disabled = false
    finalBtn.classList.add("enabled")
  } else {
    finalBtn.disabled = true
    finalBtn.classList.remove("enabled")
  }
}

async function submitAllCoherencias() {
  const selectionsArray = Object.values(coherenciaSelections)
  button = document.getElementById("finalSubmitBtn")
  button.disabled = true

  if (selectionsArray.length === 0) {
    showMessage('<i class="fas fa-exclamation-circle"></i> No hay evaluaciones para enviar', "error")
    return
  }

  showMessage(`<i class="fas fa-spinner fa-spin"></i> Enviando ${selectionsArray.length} evaluaciones...`, "loading")

  try {
    const response = await fetch("https://hook.eu2.make.com/gaurg2exleqajrtl3jf5u4h558ejv2sy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ evaluaciones: selectionsArray, sessionToken: sessionToken }),
    })

    if (!response.ok) {
      throw new Error(`Error del servidor: ${response.status}`)
    }

    showMessage(`<i class="fas fa-check-circle"></i> Reporte enviado con éxito`, "success", 1000)

    const finalBtn = document.getElementById("finalSubmitBtn")
    finalBtn.disabled = true
    finalBtn.classList.remove("enabled")
    finalBtn.innerHTML = '<i class="fas fa-check"></i> Evaluaciones Enviadas'

    setTimeout(() => {
      clearAllColumns()
    }, 1000)
  } catch (err) {
    console.error("[v0] Error al enviar evaluaciones:", err)
    showMessage('<i class="fas fa-exclamation-circle"></i> Error al enviar evaluaciones: ' + err.message, "error")
  }
}

function findMatchingWeekByDate(fechaClase, weeklyArray, usedWeeks = new Set()) {
  const claseDateParts = fechaClase.split("/")
  const classDate = new Date(claseDateParts[2], claseDateParts[1] - 1, claseDateParts[0])
  classDate.setHours(0, 0, 0, 0)

  let closestWeek = null
  let smallestDifference = Number.POSITIVE_INFINITY

  for (const week of weeklyArray) {
    const startParts = week.fechaInicio.split("/")
    const startDate = new Date(startParts[2], startParts[1] - 1, startParts[0])
    startDate.setHours(0, 0, 0, 0)
    const endParts = week.fechaFin.split("/")
    const endDate = new Date(endParts[2], endParts[1] - 1, endParts[0])
    endDate.setHours(23, 59, 59, 999)

    if (classDate >= startDate && classDate <= endDate) {
      return week
    }

    const distanceToStart = Math.abs(classDate - startDate)
    const distanceToEnd = Math.abs(classDate - endDate)
    const minDistance = Math.min(distanceToStart, distanceToEnd)

    if (minDistance < smallestDifference) {
      smallestDifference = minDistance
      closestWeek = week
    }
  }

  if (closestWeek && smallestDifference <= 2 * 24 * 60 * 60 * 1000) {
    return closestWeek
  }

  return null
}

function showMessage(text, type, duration = 5000) {
  messageDiv.innerHTML = text
  messageDiv.className = "message " + type
  messageDiv.classList.remove("hidden")

  if (type === "success") {
    setTimeout(() => {
      messageDiv.classList.add("hidden")
    }, duration)
  } else {
    setTimeout(() => {
      messageDiv.classList.add("hidden")
    }, duration)
  }
}

async function sendCoherencia(docente, temaDado, temaEsperado, coherencia, grupo, asignatura, fechaClase) {
  temaDado = temaDado.replace(/&apos;/g, "'").replace(/&quot;/g, '"')
  temaEsperado = temaEsperado.replace(/&apos;/g, "'").replace(/&quot;/g, '"')

  const payload = {
    temaDado: temaDado,
    temaEsperado: temaEsperado,
    coherencia: coherencia,
    docente: docente,
    grupo: grupo,
    asignatura: asignatura,
    fechaClase: fechaClase,
    iaActivada: iaActivada,
  }

  console.log("[v0] Enviando coherencia:", payload)

  try {
    showMessage('<i class="fas fa-spinner fa-spin"></i> Enviando evaluación...', "loading")

    const response = await fetch("https://hook.eu2.make.com/gaurg2exleqajrtl3jf5u4h558ejv2sy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Error del servidor: ${response.status}`)
    }

    showMessage(`<i class="fas fa-check-circle"></i> Reporte enviado con éxito`, "success", 1000)

  } catch (err) {
    console.error("[v0] Error al enviar coherencia:", err)
    showMessage('<i class="fas fa-exclamation-circle"></i> Error al enviar evaluación: ' + err.message, "error")
  }
}

window.addEventListener("load", () => {
  tokenModal.style.display = "block"
})

console.log("Sistema de automatización inicializado correctamente")
