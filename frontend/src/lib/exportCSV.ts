export function exportToCSV(data: any[], filename: string) {
  if (!data || !data.length) return;

  const separator = ',';
  const keys = Object.keys(data[0]);
  
  // Добавляем BOM для правильного отображения кириллицы в Excel
  const csvContent = '\uFEFF' + 
    keys.join(separator) + '\n' +
    data.map(row => {
      return keys.map(k => {
        let cell = row[k] === null || row[k] === undefined ? '' : row[k];
        cell = cell instanceof Date ? cell.toLocaleString() : cell.toString();
        // Экранируем кавычки и оборачиваем в кавычки, если есть запятые
        cell = cell.replace(/"/g, '""');
        if (cell.search(/("|,|\n)/g) >= 0) {
          cell = `"${cell}"`;
        }
        return cell;
      }).join(separator);
    }).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if ((navigator as any).msSaveBlob) { // IE 10+
    (navigator as any).msSaveBlob(blob, filename);
  } else {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
