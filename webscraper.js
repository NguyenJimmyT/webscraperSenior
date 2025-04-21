// const puppeteer = require('puppeteer');

// const structures = [
//   { name: "Nutwood Structure", levelButtonId: "#GridView_All_LinkButton_Levels_0" },
//   { name: "State College Structure", levelButtonId: "#GridView_All_LinkButton_Levels_1" },
//   { name: "Eastside North", levelButtonId: "#GridView_All_LinkButton_Levels_2" },
//   { name: "Eastside South", levelButtonId: "#GridView_All_LinkButton_Levels_3" }
// ];

// (async () => {
//   const browser = await puppeteer.launch({
//     headless: true,
//     defaultViewport: null,
//     args: ['--start-maximized']
//   });

//   const page = await browser.newPage();
//   const url = 'https://parking.fullerton.edu/parkinglotcounts/mobile.aspx';
//   const results = [];

//   for (const structure of structures) {
//     await page.goto(url, { waitUntil: 'domcontentloaded' });

//     try {
//       await page.click(structure.levelButtonId);
//       await new Promise(resolve => setTimeout(resolve, 3000)); // allow JS to load levels
//     } catch (err) {
//       console.warn(`⚠️ Failed to click levels button for ${structure.name}`);
//       results.push({ structure: structure.name, levels: [] });
//       continue;
//     }

//     const levels = await page.evaluate(() => {
//       const rows = Array.from(document.querySelectorAll('#GridView_Levels > tbody > tr'));
//       return rows.map((row, index) => {
//         const levelName = row.querySelector(`#GridView_Levels_Label_LevName_${index}`)?.textContent.trim();
//         const total = row.querySelector(`#GridView_Levels_Label_TotalSpotsLevel_${index}`)?.textContent.trim();
//         const available = row.querySelector(`#GridView_Levels_Label_AvailForLevel_${index}`)?.textContent.trim();
//         const lastUpdated = row.querySelector(`#GridView_Levels_Label_LastUpdated_${index}`)?.getAttribute('aria-label');

//         return {
//           level: levelName,
//           total,
//           available,
//           lastUpdated
//         };
//       });
//     });

//     results.push({ structure: structure.name, levels });
//   }

//   console.log(JSON.stringify(results, null, 2));

//   await browser.close();
// })();


const puppeteer = require('puppeteer');
const fs = require('fs');

const structuresWithLevels = [
  { name: "Nutwood Structure", levelButtonId: "#GridView_All_LinkButton_Levels_0" },
  { name: "State College Structure", levelButtonId: "#GridView_All_LinkButton_Levels_1" },
  { name: "Eastside North", levelButtonId: "#GridView_All_LinkButton_Levels_2" },
  { name: "Eastside South", levelButtonId: "#GridView_All_LinkButton_Levels_3" }
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  const url = 'https://parking.fullerton.edu/parkinglotcounts/mobile.aspx';
  const results = [];

  for (const structure of structuresWithLevels) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    try {
      await page.click(structure.levelButtonId);
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (err) {
      results.push({ structure: structure.name, levels: [] });
      continue;
    }

    const levels = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#GridView_Levels > tbody > tr'));
      return rows.map((row, index) => {
        const levelName = row.querySelector(`#GridView_Levels_Label_LevName_${index}`)?.textContent.trim();
        const total = row.querySelector(`#GridView_Levels_Label_TotalSpotsLevel_${index}`)?.textContent.trim();
        const available = row.querySelector(`#GridView_Levels_Label_AvailForLevel_${index}`)?.textContent.trim();
        const lastUpdated = row.querySelector(`#GridView_Levels_Label_LastUpdated_${index}`)?.getAttribute('aria-label');
        return { level: levelName, total, available, lastUpdated };
      });
    });

    results.push({ structure: structure.name, levels });
  }

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const flatLots = await page.evaluate(() => {
    const lotRows = Array.from(document.querySelectorAll('table#GridView_All tr'));
    const lots = [];

    lotRows.forEach((row, index) => {
      const nameSpan = row.querySelector('.LocationName span');
      const total = row.querySelector(`span[id^=GridView_All_Label_Avail_${index}]`)?.getAttribute('aria-label');
      const available = row.querySelector(`span[id^=GridView_All_Label_AllSpots_${index}]`)?.textContent.trim();
      const lastUpdated = row.querySelector(`span[id^=GridView_All_Label_LastUpdated_${index}]`)?.getAttribute('aria-label');
      const name = nameSpan?.textContent.trim();

      if (name && !row.querySelector('a[id^=GridView_All_LinkButton_Levels_]')) {
        lots.push({ structure: name, totalSpots: total, availableSpots: available, lastUpdated });
      }
    });

    return lots;
  });

  results.push(...flatLots);

  const csvRows = [];
  csvRows.push(['structure', 'level', 'total', 'available', 'lastUpdated', 'time']);

  const time = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  for (const entry of results) {
    if (entry.levels) {
      for (const level of entry.levels) {
        csvRows.push([
          entry.structure,
          level.level || '',
          level.total || '',
          level.available || '',
          level.lastUpdated || '',
          time
        ]);
      }
    } else {
      csvRows.push([
        entry.structure,
        '',
        entry.totalSpots || '',
        entry.availableSpots || '',
        entry.lastUpdated || '',
        time
      ]);
    }
  }

  const csvContent = csvRows.map(row => row.map(field => `"${field}"`).join(',')).join('\n');
  const fileExists = fs.existsSync('parking_data.csv');

  if (!fileExists) {
    fs.writeFileSync('parking_data.csv', csvRows.map(row => row.join(',')).join('\n') + '\n', 'utf8');
  } else {
    const dataOnly = csvRows.slice(1);
    fs.appendFileSync('parking_data.csv', dataOnly.map(row => row.join(',')).join('\n') + '\n', 'utf8');
  }

  await browser.close();
})();
