# Notarium — przewodnik po całej strukturze

Stan: 2026-09-26, po refaktoryzacji i dodaniu DEV.

## 1. Główna zasada

Notarium ma trzy warstwy: powłokę programu, wspólne komponenty i niezależne moduły. Notatnik jest jednym z modułów, nie fundamentem całej aplikacji. Powłoka nie zna notatek, kontenerów ani danych konkretnego modułu.

## 2. Organizacja projektu

```text
C:/NOTARIUM
├── product
│   ├── source             kod źródłowy
│   ├── builds             zbudowane aplikacje
│   ├── releases           wydania i kopie bezpieczeństwa
│   ├── environment        środowiska i kopie do weryfikacji
│   ├── test_installation  instalacje testowe
│   ├── runtime            miejsce na zasoby uruchomieniowe
│   ├── documentation      dokumentacja produktu
│   └── operations
├── management/documentation
│   ├── notes
│   ├── comments
│   └── milestones
├── operations/tests       raporty weryfikacji
├── AI/chatgpt
└── .project-control
```

To organizacja projektu, nie lista wdrożonych funkcji. Pusty katalog nie oznacza działającego backendu. Dane notatek pozostają w dotychczasowym katalogu użytkownika.

## 3. Organizacja kodu

```text
product/source
├── App.xaml / App.xaml.cs  uruchomienie
├── Shell                   panel i wykrywanie modułów
├── Shared
│   ├── Contracts           umowa powłoka–moduł
│   ├── UI                  wspólne komponenty WPF
│   ├── Web/UI              wspólne komponenty JavaScript
│   └── WebHost             inicjalizacja WebView2
├── Modules
│   ├── Notebook            działający Notatnik
│   ├── Dev                 działająca galeria
│   ├── Calendar            planowany Kalendarz
│   ├── Collections         planowane Kolekcje
│   └── Prompting           planowany Prompting
├── Tests                   testy natywne i architektury
├── Assets                  zasoby aplikacji
└── build.ps1               budowanie, testy i pakowanie
```

## 4. Powłoka i kontrakt

App uruchamia Shell/MainPanel. MainPanel tworzy panel i otwiera moduły. Ponowne kliknięcie modułu aktywuje istniejące okno zamiast tworzyć duplikat.

ModuleCatalog wykrywa implementacje w Modules/*/Notarium.*.dll. ModuleEntry oddziela widoczną pozycję produktu od dostępnej implementacji. Pięć znanych pozycji pozostaje widocznych bez plików; dodatkowe wykryte moduły też trafiają na listę. Brak implementacji daje komunikat, nie awarię. Problemy z ładowaniem są raportowane oddzielnie.

Shared/Contracts/INotariumModule wymaga identyfikatora, nazwy i funkcji CreateWindow. To kontrakt uruchamiania interfejsu, nie wspólna struktura danych.

## 5. Wspólny interfejs

WPF i WebView mają różne środowiska wykonania. Nie współdzielą jednej klasy uruchamianej w C# i JavaScript, ale mają wspólne zasady i parametry.

Shared/UI zawiera ActionButton, MenuBar, DropDownMenu, ToolPanel, TabCard, CompositePanel, DialogService i Theme.xaml. Dropdown obsługuje pasek File/Edit/View/Help, formatowanie, zoom i menu kart. MenuItem pozostaje definicją akcji, nie osobnym rendererem. Pozycja menu jest zakotwiczona do lewego dołu przycisku niezależnie od systemowej polityki wyrównywania.

Shared/Web/UI zawiera przyciski, panele, pola, przełączniki, etykiety, uchwyty i dialogi. DropDownMenu obsługuje akcje, wybory formularzy, PPM i sugestie. Native select przechowuje wartość, ale nie renderuje własnej listy. VisualRegistry obejmuje również elementy dodawane dynamicznie.

Obie implementacje menu czytają Shared/UI/ui-policy.json: kolory, minimalną wysokość pozycji i maksymalną wysokość listy. DialogService jest wspólnym wejściem do natywnych okien wyboru pliku, koloru i komunikatów.

Shared/WebHost/ModuleWebRuntime inicjalizuje loader WebView2 tylko raz w procesie. DEV i Notatnik używają tej samej biblioteki, aby kolejność otwierania nie wymuszała ponownej konfiguracji już uruchomionego loadera. Powłoka nie zależy od WebHost.

## 6. Moduł Notatnika

NotebookModule jest wejściem dla powłoki. MainWindow.xaml definiuje układ, a MainWindow.xaml.cs składa części i zarządza cyklem życia. MainWindow.ViewRouting.cs oraz Views/MainWindow.*.cs kierują zdarzenia do usług.

Controls/NotebookLibraryPanel i NotebookTabsPanel są własnymi widokami biblioteki i kart.

| Usługa | Odpowiedzialność |
|---|---|
| NotebookLibrary | Notatki, nazwy, ulubione, import, usuwanie i zapis |
| NotebookTabs | Otwarte karty, aktywacja, szerokości i paginacja |
| NotebookAutosave | Harmonogram zapisu |
| NotebookFormatting | Polecenia formatowania i definicje wyborów |
| NotebookRuntime | Adapter wspólnej inicjalizacji WebView2 |

Note i OpenNote są modelami notatki i karty. NoteStore zapisuje bibliotekę. Core zawiera pomocnicze mechanizmy i konwersje dokumentów; jest częścią Notatnika, nie przyszłym backendem całego Notarium. Legacy to stary edytor wyłączony z aplikacji.

## 7. Edytor i kontenery

WebEditorControl jest mostem: przekazuje dokument i polecenia, odbiera zmiany, zaznaczenie i błędy. Wiadomości zmian zawierają ID notatki, więc spóźniona wiadomość nie zmienia innej notatki.

Tiptap/ProseMirror obsługuje dokument i transakcje. CodeMirror obsługuje kod; jego zmiany trafiają do wspólnej historii dokumentu. Cropper obsługuje kadrowanie, KaTeX matematykę. Elementy wewnętrzne tych silników pozostają ich własnością.

| Plik WebEditor/src | Odpowiedzialność |
|---|---|
| container-types.js | Klasy typów, etykiety, minima wymiarów, początkowa treść i atrybuty kopiowania |
| container-interactions.js | Adapter zdarzeń i pierwszeństwo kontrolek |
| containers.js | Wybór, schowek, granice, gesty i operacje dokumentu |
| container-visual.js | Panele, podświetlenia, geometria i podgląd gestów |
| containers.css | Wygląd kontenerów i uchwytów |
| container-keyboard.js | Operacje klawiatury |
| block-movement.js | Przenoszenie elementów |
| storage.js | Import, eksport i struktura dokumentu |

Text, Empty, nagłówki, cytaty, listy, kod, obraz, matematyka, tabela i grupa mają własne klasy polityk. Empty jest wariantem Text: pustym paragrafem z atrybutem, nie odrębnym formatem pliku. Po wpisaniu treści zachowuje się jak Text.

## 8. Przepływ zmiany

Przy zmianie szerokości kontenera: adapter rozpoznaje gest → logika oblicza dozwoloną geometrię według typu → warstwa wizualna pokazuje podgląd → zatwierdzenie zmienia dokument i historię → most przekazuje dokument → biblioteka aktualizuje notatkę → autosave planuje zapis.

Podgląd wizualny, transakcja dokumentu i zapis na dysku mają osobne odpowiedzialności. Zmiana wyglądu nie powinna zmieniać reguł kopiowania, przesuwania ani przechowywania.

## 9. Dane

NoteStore zapisuje bibliotekę w %LOCALAPPDATA%/Notatnik/notes.json. DocumentJson zawiera wersjonowaną strukturę; Content jest eksportem Markdown dla zgodności. Zapis używa pliku tymczasowego i kopii poprzedniej wersji .bak. Historia cofania jest sesyjna, nie jest zapisywana na dysku.

DEV używa %LOCALAPPDATA%/Notarium/dev-gallery na zasoby i cache WebView2. Nie czyta notatek. Przykładowe okna wyboru pliku i zapisu nie importują ani nie zapisują dokumentów.

## 10. Opcjonalność i przyszłość

Usunięcie całego katalogu modułu ze źródeł pozwala budować powłokę. Usunięcie go z wydania wyłącza jego funkcjonalność po ponownym uruchomieniu. Widoczna pozycja zostaje i informuje o braku implementacji. Nie ma hot-unload ani gwarancji działania po usunięciu losowej pojedynczej zależności.

Kalendarz, Kolekcje i Prompting mają jedynie katalogi z opisami. Wspólna baza, linkowanie i inteligentne zachowania nie powstały. Przyszły fundament powinien mieć kontrakty niezależne od widoków modułów.

## 11. Weryfikacja

build.ps1 warunkowo buduje i testuje obecne moduły. Publikacja wykrywa ich projekty, bez odwołań powłoki do konkretnych implementacji. Testy webowe sprawdzają rzeczywiste interakcje; natywne używają izolowanych danych, tworzą prawdziwe widoki i czekają na gotowość WebView2.

DEV jest miejscem ręcznych prób komponentów, nie zamiennikiem automatycznych testów ani dowodem braku wszystkich błędów. Opisy odpowiedzialności należy aktualizować wraz z kodem; raporty testów są oddzielne.
