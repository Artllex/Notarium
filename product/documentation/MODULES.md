# Moduły i DEV tests

| Pozycja | ID | Katalog | Stan |
|---|---|---|---|
| Notatnik | notebook | Modules/Notebook | Działający |
| Kalendarz | calendar | Modules/Calendar | Opis, brak implementacji |
| Kolekcje | collections | Modules/Collections | Opis, brak implementacji |
| Prompting | prompting | Modules/Prompting | Opis, brak implementacji |
| DEV tests | dev | Modules/Dev | Działająca galeria |

Brak implementacji jest normalnym stanem. Kliknięcie pokazuje komunikat Brak modułu, nie zamyka programu. Sam pusty katalog lub README nie oznacza dostępnej implementacji.

## Galeria DEV

Zakładki Windows/WPF i Edytor/Web pokazują rzeczywiste wspólne komponenty. Można sprawdzić dropdown zwykły, listę wyboru, sugestie, PPM i menu w dialogu; normalne i wyłączone przyciski, pola, przełączniki i uchwyt. WPF pokazuje również MenuBar, ToolPanel, TabCard, CompositePanel i DialogService.

Wynik interakcji jest widoczny na ekranie. Galeria nie zmienia notatek, a okno zapisu nie zapisuje plików. DEV nie zależy od Notatnika; obydwa moduły korzystają ze wspólnych Contracts/UI i WebHost.

## Dodawanie modułu

1. Utworzyć Modules/Nazwa i projekt Notarium.Nazwa.csproj.
2. Implementować INotariumModule: stabilne ID, nazwa i CreateWindow.
3. Korzystać ze wspólnych komponentów zamiast kopiować ich wygląd i zachowanie.
4. Logikę oraz dane utrzymywać w module, nie w powłoce.
5. Zbudować zasoby przed publikacją. Powłoka automatycznie publikuje projekty Modules/*/Notarium.*.csproj; nietypowe kroki budowania i testów trzeba dodać do build.ps1.
6. Dodać dokumentację i testy; sprawdzić usunięcie modułu oraz kolejność otwierania z innymi modułami.

Dodatkowy wykryty moduł trafia do panelu dynamicznie. Znane, planowane pozycje są w Shell/ModuleCatalog.cs, aby były widoczne również bez implementacji.
