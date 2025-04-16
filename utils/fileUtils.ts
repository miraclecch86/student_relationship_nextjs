// JSON 데이터를 파일로 다운로드하는 함수
export function downloadJson(data: any, filename: string) {
  const jsonStr = JSON.stringify(data, null, 2); // null, 2는 예쁘게 포맷팅
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 업로드된 JSON 파일을 읽어 파싱하는 함수
export function readJsonFile(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        resolve(json);
      } catch (error) {
        reject(new Error('파일을 파싱하는 중 오류가 발생했습니다. 유효한 JSON 파일인지 확인해주세요.'));
      }
    };
    reader.onerror = (error) => {
      reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
    };
    reader.readAsText(file);
  });
} 