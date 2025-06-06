const semanas = [];
const rawJSON = [
  {
    Semana1: [
      'Introducción a la asignatura, Acuerdos sobre el desarrollo de la materia, asignación de trabajos, Entrega del Micro currículo, bibliografía y normas de convivencia',
      '08/02/2025'
    ],
    Semana2: [ 'Conceptualización: Ética y Moral', '15/02/2025' ],
    Semana3: [ 'Construcción ético - moral del ser humano', '22/02/2025' ],
    Semana4: [
      'Corrientes Éticas Clásicas: Ética de virtudes, Epicureísmo, Estoicismo, Neoplatonismo',
      '01/03/2025'
    ],
    Semana5: [
      'La ética para Sócrates, Platón y Aristóteles, Clásica y medieval',
      '08/03/2025'
    ],
    Semana6: [ 'Parcial', '15/03/2025' ],
    Semana7: [
      'La importancia de las corrientes éticas (Utilitarismo, Ética Kantiana, Ética del Superhombre, Ética)',
      '22/03/2025'
    ],
    Semana8: [ 'La vida humana y el bien moral por excelencia', '29/03/2025' ],
    Semana9: [
      'Las virtudes desde la ética (Aristóteles, Kant, Nietzsche y Habermas)',
      '05/04/2025'
    ],
    Semana10: [ 'Semana de receso', '12/04/2025' ],
    Semana11: [
      'Ética contemporánea y sus principales representantes. Corrientes éticas (Ética Axiológica, Ética de la Liberación y Ética Comunicativa) y su influencia en la actualidad',
      '19/04/2025'
    ],
    Semana12: [ 'Ética, Política y Educación', '26/04/2025' ],
    Semana13: [ 'Bioética', '03/05/2025' ],
    Semana14: [
      'Sustentación de ensayos basados en las corrientes éticas vistas en el semestre',
      '10/05/2025'
    ],
    Semana15: [
      'Exposiciones corrientes éticas y su aplicación en la realidad colombiana, Ejercicio ético',
      '17/05/2025'
    ],
    Semana16: [ 'Examen final', '24/05/2025' ]
  }
]

const rawJSON2 = rawJSON[0];
for (const semanaKey in rawJSON2) {
    if (!rawJSON2.hasOwnProperty(semanaKey)) continue;

    const arr = rawJSON2[semanaKey];
    if (!Array.isArray(arr) || arr.length < 2) continue;

    const temasEsperados = String(arr[0]).trim();
    const fechaFinStr = String(arr[1]).trim(); // formato "DD/MM/YYYY"
    const fechaFinDate = parseDateDMY(fechaFinStr);

    semanas.push({
        temasEsperados,
        fechaFinDate,
        fechaFinStr
    });
}

// Ordenar semanas por fechaFinDate ascendente
semanas.sort((a, b) => a.fechaFinDate - b.fechaFinDate);

// console.log("rawJSON2:", rawJSON2);
console.log("Semanas procesadas:", semanas);

function parseDateDMY(str) {
  const parts = str.split('/');
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}
