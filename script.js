const url = 'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json';

async function fetchData() {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Errore nel recupero dati: ' + response.status);
    }
    const data = await response.json();
    processData(data);
  } catch (err) {
    document.getElementById('info').innerHTML = `<p style="color:red;">${err.message}</p>`;
  }
}

function processData(json) {
  const header = json[0];
  const rows = json.slice(1);

  const idxTime = header.indexOf('time_tag');
  const idxDensity = header.indexOf('density');
  const idxSpeed = header.indexOf('speed');
  const idxTemp = header.indexOf('temperature');

  
  if (!rows[0]) {
    document.getElementById('info').innerHTML = "<p>Nessun dato trovato.</p>";
    return;
  }

  let rowSelected = rows[0];
  const timeTag = rowSelected[idxTime];
  const density = rowSelected[idxDensity];
  const speed = rowSelected[idxSpeed];
  const temperature = rowSelected[idxTemp];

  const infoEl = document.getElementById('info');
  infoEl.innerHTML = `
    <table>
      <tr><th>Parametro</th><th>Valore</th></tr>
      <tr><td>Time Tag (≈ un’ora fa)</td><td>${timeTag}</td></tr>
      <tr><td>Densità (protoni/cm³)</td><td>${density}</td></tr>
      <tr><td>Velocità (km/s)</td><td>${speed}</td></tr>
      <tr><td>Temperatura (K)</td><td>${temperature}</td></tr>
    </table>
  `;

  document.getElementById('updateTime').textContent = timeTag;
}

// Avvio
fetchData();

// (Aggiorna ogni 5 minuti)
setInterval(fetchData, 0.5*60*1000);

