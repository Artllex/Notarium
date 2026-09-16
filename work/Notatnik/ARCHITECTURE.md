# Fundament Notatnika — zintegrowane silniki

## Granice odpowiedzialności

- WPF: okno, biblioteka, karty, menu, pliki i zapis. `MainWindow` nie interpretuje Markdown.
- `WebEditorControl`: adapter WebView2, komunikaty identyfikowane przez ID notatki,
  inicjalizacja, zamknięcie z opróżnieniem zmian i otwieranie linków w przeglądarce.
- `WebEditor/src/editor.js`: Tiptap/ProseMirror, formatowanie, listy i sesje dokumentów.
- `WebEditor/src/code-cell.js`: węzeł komórki z CodeMirror 6 (Python), obramowaniem,
  przesuwaniem i usuwaniem. Zmiany CodeMirror trafiają do transakcji ProseMirror.
- `WebEditor/src/storage.js`: import starego Markdown, eksport i wersjonowany JSON.
- `NoteStore`: zapis atomowy; `Core/RichDocumentText`: tekst do podglądu listy notatek.
- `Legacy/`: stary edytor zachowany dla historycznych testów, wyłączony z aplikacji.

## Kontrakty

1. Dokument ma format `{version:1, doc:...}` w `DocumentJson`. To źródło prawdy
   dla edytowanych notatek. `Content` pozostaje eksportem Markdown dla zgodności.
2. Stare notatki są importowane przy otwarciu, ale zapisywane w nowym formacie
   dopiero po edycji. Pierwszy taki zapis istniejącej biblioteki tworzy
   `notes.json.pre-tiptap.json`; zwykła kopia poprzedniej wersji to `notes.json.bak`.
3. Jedna historia ProseMirror obejmuje tekst, formatowanie i komórki. CodeMirror
   nie ma osobnej historii. Sesje notatek zachowują Undo podczas przełączania;
   historia nie jest zapisywana na dysku.
4. Komunikaty zmian zawierają ID, więc opóźniona wiadomość nie zmienia innej notatki.
   Eksport pliku i zamknięcie okna czekają na potwierdzenie bieżącego dokumentu.
5. Wygląd i powiększenie nie modyfikują treści. Znaczniki HTML nie są ukrywane
   w edytowalnym tekście: kolor i czcionka to atrybuty modelu dokumentu.

## Uruchamianie i budowanie

Windows 10 (2004+) lub Windows 11 z WebView2 Runtime. Zależności JavaScript
są przypięte w package-lock.json; pakiet nie pobiera skryptów z CDN.
HTML/CSS/JS są osadzone w aplikacji i udostępniane przez lokalny host WebView2.
Profil przeglądarki i zasoby trafiają do LocalAppData/Notatnik/web-editor.
Import HTML jest oczyszczany; nawigacja poza edytor jest blokowana, do systemowej
przeglądarki trafiają tylko linki HTTP/HTTPS/mailto.

Z katalogu głównego workspace:

```powershell
./work/Notatnik/build.ps1
dotnet run --project work/WebHostCheck/WebHostCheck.csproj -c Release
```

Skrypt buduje frontend, uruchamia jego testy w zainstalowanym Edge i publikuje
samowystarczalny pakiet .NET do outputs/Notatnik-engines. Pierwsze budowanie
wymaga dostępu do rejestrów npm/NuGet. Testy używają izolowanych danych.

## Zakres i ograniczenia

Wzory: oficjalne rozszerzenie Mathematics Tiptap z KaTeX, przycisk ∑,
podgląd LaTeX i edycja kliknięciem we wzór. Eksport używa `$...$` i `$$...$$`.
Obrazy: rozszerzenie Image, plik / wklejenie / przeciągnięcie, osadzone dane obrazu
w dokumencie. Maksymalna szerokość wyświetlania to 200 CSS px z zachowaniem
proporcji; mniejsze obrazy nie są powiększane. Oryginalna rozdzielczość zostaje
zachowana. Plik obrazu może mieć do 20 MB. Fonty KaTeX są dołączone lokalnie.

Komórki obsługują edycję i kolorowanie składni; wykonywanie Pythona nie jest
podłączone (przycisk Run jest jawnie nieaktywny). AI, sejfy i kalendarz nie są
częścią tej integracji. Markdown jest formatem wymiany: pełny model dokumentu
jest przechowywany w JSON. Nietypowe stare konstrukcje mogą wymagać dalszych
reguł importu; oryginalna biblioteka jest zachowywana w kopii migracyjnej.
