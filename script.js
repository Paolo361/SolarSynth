// Utility: pulisce e converte il JSON NOAA (salta eventuale header)
  function parseNoaaJson(raw) {
    const rows = Array.isArray(raw) ? raw.slice() : [];
    // Se la prima riga è intestazione (contiene stringhe come "time_tag"), salta la prima
    if (rows.length && Array.isArray(rows[0])) {
      const first = rows[0][0];
      if (typeof first === 'string' && isNaN(Date.parse(first))) {
        // Probabilmente header -> rimuovi
        rows.shift();
      }
    }
    return rows;
  }

  // Filtra punti non validi e ritorna array di oggetti {t: Date, density, speed, temp}
  function extractPoints(rows) {
    const pts = [];
    for (const r of rows) {
      const timestr = r[0];
      const t = new Date(timestr);
      if (isNaN(t)) continue;

      // i campi possono essere stringhe; converti a number e filtra valori non numerici
      const dens = Number(r[1]);
      const spd  = Number(r[2]);
      const tmp  = Number(r[3]);

      // accetta anche se qualche valore è NaN (lo terremo fuori per quel grafico)
      pts.push({
        t,
        density: Number.isFinite(dens) ? dens : null,
        speed:   Number.isFinite(spd)  ? spd  : null,
        temp:    Number.isFinite(tmp)  ? tmp  : null
      });
    }
    // Assicurati che siano ordinati per tempo
    pts.sort((a,b) => a.t - b.t);
    return pts;
  }

  // Interpolazione lineare: input x (ms timestamps) e y (numeric), newX (ms)
  function linearInterpolate(x, y, newX) {
    const newY = [];
    if (x.length < 2) return newX.map(() => NaN);

    let j = 0;
    for (let i = 0; i < newX.length; i++) {
      const xi = newX[i];
      // sposta j così che xi sia tra x[j] e x[j+1]
      while (j < x.length - 2 && xi > x[j + 1]) j++;
      const x0 = x[j], x1 = x[j+1];
      const y0 = y[j], y1 = y[j+1];

      // se uno dei due y è null/NaN -> risultato null
      if (!Number.isFinite(y0) || !Number.isFinite(y1) || x1 === x0) {
        newY.push(NaN);
        continue;
      }

      const t = (xi - x0) / (x1 - x0);
      newY.push(y0 + t * (y1 - y0));
    }
    return newY;
  }

  // Costruisce chart con Chart.js; dataPoints = array di {x: Date, y: number}
  function buildChart(canvasId, label, dataPoints, yLabel) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label,
          data: dataPoints,
          parsing: false, // usiamo oggetti {x, y}
          showLine: true,
          pointRadius: 0.8,
          borderWidth: 1.5,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            type: 'time',
            time: {
              tooltipFormat: 'yyyy-MM-dd HH:mm',
              displayFormats: { hour: 'HH:mm', day: 'yyyy-MM-dd' }
            },
            title: { display: true, text: 'Time (UTC)' }
          },
          y: {
            beginAtZero: false,
            title: { display: true, text: yLabel }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false }
        }
      }
    });
  }

  async function fetchAndDraw() {
    try {
      const url = 'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json';
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Errore fetch: ' + resp.status);
      const raw = await resp.json();

      const rows = parseNoaaJson(raw);
      const pts = extractPoints(rows);

      if (pts.length === 0) throw new Error('Nessun punto valido trovato nel JSON.');

      // Costruisci i vettori temporali e vettori per ogni variabile (NaN per mancate letture)
      const timesMs = pts.map(p => p.t.getTime());
      const densityArr = pts.map(p => p.density);
      const speedArr = pts.map(p => p.speed);
      const tempArr = pts.map(p => p.temp);

      // Nuovo asse regolare (200 punti)
      const numPoints = 300;
      const minT = timesMs[0], maxT = timesMs[timesMs.length - 1];
      const newX = [];
      for (let i = 0; i < numPoints; i++) newX.push(minT + (i/(numPoints-1))*(maxT-minT));

      const densityInterp = linearInterpolate(timesMs, densityArr, newX);
      const speedInterp   = linearInterpolate(timesMs, speedArr,   newX);
      const tempInterp    = linearInterpolate(timesMs, tempArr,    newX);

      // Converti in array {x: Date, y: value} e rimuovi NaN finali (Chart.js può gestire NaN ma meglio filtrarli)
      const densityPoints = newX.map((nx,i) => ({ x: new Date(nx), y: Number.isFinite(densityInterp[i]) ? densityInterp[i] : null }))
                                  .filter(p => p.y !== null);
      const speedPoints   = newX.map((nx,i) => ({ x: new Date(nx), y: Number.isFinite(speedInterp[i]) ? speedInterp[i] : null }))
                                  .filter(p => p.y !== null);
      const tempPoints    = newX.map((nx,i) => ({ x: new Date(nx), y: Number.isFinite(tempInterp[i]) ? tempInterp[i] : null }))
                                  .filter(p => p.y !== null);

      // Costruisci i grafici
      buildChart('chart-temp', 'Temperature (K)', tempPoints, 'K');
      buildChart('chart-speed', 'Velocity (km/s)', speedPoints, 'km/s');
      buildChart('chart-density', 'Density (protoni/cm³)', densityPoints, 'protoni/cm³');

    } catch (err) {
      console.error('Errore:', err);
      alert('Errore nel caricamento/disegno: ' + err.message + '. Controlla console.');
    }
  }

  // Avvia
  fetchAndDraw();