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

Nazwa produktu i pliku wykonywalnego: Notarium. Istniejący katalog danych
LocalAppData/Notatnik pozostaje zachowany, aby otwierać dotychczasowe notatki.
Dwuklik w nazwę języka komórki otwiera pole z katalogiem CodeMirror language-data.
Enter lub wybór z podpowiedzi zatwierdza język, Esc anuluje. Język steruje
kolorowaniem składni i jest zachowany w JSON oraz eksporcie Markdown.
Parsery są dołączone do lokalnego pakietu; wykonywanie kodu pozostaje nieaktywne.

Szerokość składu jest atrybutem dokumentu `contentWidth`: 650, 790, 960 px
lub 0 oznaczające pełną szerokość. Przycisk `↔` na pasku pokazuje wartość
aktywnej notatki. Zmiana należy do historii ProseMirror, zapisuje się w JSON,
a dokument artykułowy zachowuje ją także w znaczniku eksportu Markdown.
Starszy znacznik `<!-- notarium:article -->` jest importowany jako 790 px.

Przenoszenie sekcji: wspólny moduł `block-movement.js` operuje na kontenerach
pierwszego poziomu dokumentu (akapit, nagłówek, lista, tabela, komórka kodu,
wzór, obraz). Uchwyt w górnym pasku kontenera pozwala przenosić każdy taki blok.
Komórkę można także chwycić za obramowanie lub nagłówek, a obraz i wzór
bezpośrednio. Linia wskazuje granicę wstawienia przed/za sekcją; przy krawędzi
widoku dokument przewija się automatycznie. Listy i tabele przenoszone są
w całości, wraz z zawartością. Esc anuluje ruch, zmiana notatki lub dokumentu
przerywa nieaktualny gest. Każdy ruch to jedna transakcja wspólnej historii.
Każdy blok najwyższego poziomu otrzymuje wspólny widok ContainerView.
Klasa deleguje edycję treści do istniejącego widoku Tiptap/CodeMirror/TableKit,
a sama zapewnia ramkę, uchwyt przesuwania, zmianę szerokości i minimalnej
wysokości, tytuł i stopkę oraz wyrównanie zaznaczonego kontenera z paska.
Tło jest opcjonalnym atrybutem boxBackground (kolor HEX albo null — brak koloru),
ustawianym w tym samym oknie kontenera. Zmiana jest zapisywana i cofana wspólnie
z dokumentem. Wzory nie otrzymują dodatkowego tła ze stylu artykułu.
Pasek ikon pojawia się na hover z animacją opacity 0.5 → 1 przez 180 ms;
przy preferencji ograniczonego ruchu animacja jest wyłączona.
Przeciągnięcie przy bocznej krawędzi celu tworzy węzeł layoutRow z blokami
obok siebie. Przeciągnięcie nad/pod wiersz wyciąga blok; pojedynczy pozostały
blok wraca na najwyższy poziom. Operacje używają transakcji ProseMirror,
zachowują cofanie i zapis JSON/HTML w Markdown. Wysokość jest minimalna,
aby dłuższa treść pozostawała dostępna.

Wzory: oficjalne rozszerzenie Mathematics Tiptap z KaTeX, przycisk ∑,
podgląd LaTeX i edycja dwuklikiem we wzór. Opcja numerowania dotyczy wzorów
w osobnym wierszu. Licznik CSS wylicza (1), (2), … w kolejności dokumentu,
bez dodatkowych transakcji historii. Licznik jest osobny dla każdej notatki.
Wzory blokowe można przenosić przeciągnięciem; całe przeniesienie jest jedną
operacją w historii cofania.
Eksport używa `$...$` i `$$...$$`, a numerowane wzory zachowuje jako HTML.
Obrazy: rozszerzenie Image, plik / wklejenie / przeciągnięcie, osadzone dane obrazu
w dokumencie. Początkowa szerokość wyświetlania to maksymalnie 200 CSS px z zachowaniem
proporcji; mniejsze obrazy nie są powiększane. Dwuklik otwiera ustawienia szerokości
(20–4000 px), widocznego tytułu, stopki i kadrowania Cropper.js. Położenie
ustawia się przyciskami wyrównania po zaznaczeniu kontenera. Układ obrazu
obok tekstu powstaje przez przeciągnięcie kontenerów do wspólnego wiersza.
Widok ogranicza obraz do
szerokości edytora. Oryginalna rozdzielczość zostaje
zachowana. Plik obrazu może mieć do 20 MB. Fonty KaTeX są dołączone lokalnie.

Tabele: oficjalny TableKit Tiptap (ProseMirror tables), wstawianie 1–20 wierszy
i kolumn, edycja komórek, wierszy i kolumn, scalanie oraz przeciąganie granic
kolumn. Przycisk ▦ otwiera także polecenia dla tabeli pod kursorem.
Dwuklik na obramowaniu kontenera tabeli otwiera tytuł, stopkę i wymiary.
Tytuły i stopki są stałymi polami RichLabelView (Tiptap), bez trybu edycji
na dwuklik. Kliknięcie ustawia kursor, a wspólny pasek formatuje aktywne pole.
Tekst i bezpieczny HTML formatowania zapisują się w atrybutach obiektu;
zmiany trafiają do historii dokumentu, łącznie z Ctrl+Z z poziomu podpisu.
Pola tworzą silnik dopiero, kiedy mają treść. Zmiana notatki niszczy stare
widoki i usuwa aktywny cel paska. Obsługa zaznaczenia należy do danego pola,
nie do nadrzędnego kontenera.

ContainerView.resetDimensions resetuje szerokość (prawa krawędź), wysokość
(dolna) lub oba wymiary (róg). Reset szerokości oznacza pełną szerokość.
Przezroczysty obszar chwytania pozostaje większy od ciągłej linii 1 px.
ImageCropSession zarządza sesją Cropper.js w miejscu obrazu. Pole X:Y ustawia
proporcje; puste oznacza dowolne. Enter, przycisk akceptacji lub kliknięcie
poza sesją zatwierdza; Esc anuluje. Źródło pozostaje nienaruszone. Kadrowanie
zapisuje współrzędne i rozmiary oryginału, a widok wycina je przez viewport
o proporcjach kadru z absolutnie pozycjonowanym obrazem. Obraz nie rozciąga
viewportu i przycięcie samego dołu nie zmienia skali ani szerokości.
Obrazy z podpisami i tabele eksportowane są jako bezpieczny HTML w Markdown,
aby zachować atrybuty przy ponownym imporcie. Pełny zapis pozostaje w JSON.

Komórki obsługują edycję i kolorowanie składni; wykonywanie Pythona nie jest
podłączone (przycisk Run jest jawnie nieaktywny). AI, sejfy i kalendarz nie są
częścią tej integracji. Markdown jest formatem wymiany: pełny model dokumentu
jest przechowywany w JSON. Nietypowe stare konstrukcje mogą wymagać dalszych
reguł importu; oryginalna biblioteka jest zachowywana w kopii migracyjnej.

Kolor tekstu i podświetlenia mają dzielone przyciski: 24 px ikona i 18 px strzałka. Główna część
przełącza ostatnio wybrany kolor, a mała strzałka w prawym dolnym rogu otwiera
paletę. Stan formatowania pod kursorem jest raportowany przez WebEditorControl,
więc ponowne kliknięcie usuwa aktywny kolor. Pozycja „Więcej kolorów…“ korzysta
z systemowego ColorDialog i zwraca kolor RGB jako #RRGGBB. Ostatnia barwa jest
widoczna na pasku pod ikoną i staje się barwą głównego przycisku.

Kontener grupujący blockGroup przechowuje bloki jako dzieci w modelu ProseMirror.
Przycisk + Kontener tworzy grupę; przeciągnięcie do jej wnętrza przenosi tam
sekcję. Grupy mogą zawierać kolejne grupy. Krawędzie celu nadal służą do
przestawiania przed/za oraz ustawiania obok siebie. ContainerView obsługuje
także dzieci grup, a wspólne transakcje zachowują zapis, formatowanie i undo.
Przeniesienie rodzica do własnego potomka jest odrzucane.
Reset wymiarów rozpoznaje również parę pointerup, ponieważ zapobieganie
domyślnemu pointerdown podczas resize może tłumić natywny dblclick.

Dolny pasek pokazuje utworzenie i SavedAtUtc. NoteStore publikuje czas zapisu
dopiero po udanym zastąpieniu pliku; błędy zapisu pozostawiają poprzednią datę.
Starsze notatki bez tej daty wyświetlają „Ostatni zapis: —” do pierwszego
udanego zapisu w nowej wersji.
