# Git i jeden aktualny build — naprawa 2026-09-26

## Repozytorium

- Kanoniczny katalog: C:/NOTARIUM, gałąź main.
- Origin: https://github.com/Artllex/Notarium.git. Nie wykonano push.
- Zachowano poprzednią historię; cee55c8 i 8ab5902 są przodkami nowego main.
- 4b0253c: przeniesienie projektu, aktualna refaktoryzacja i DEV.
- d73b733: jeden bieżący build, tymczasowe dane testów i zasady pracy.
- Unikalny ZIP źródeł sprzed centralizacji zachowano jako commit c4ab56bd376000b21ae1e1079eb10d0feae216d0 na gałęzi codex/pre-centralization. Snapshot ma ścieżki product/source i nie wymaga utrzymywania ZIP jako wersji projektu.
- Stary katalog inbox nie został usunięty; jego oryginalne repozytorium i pozostałe materiały pozostają nienaruszone. Nie jest już kanonicznym miejscem pracy nad Notarium.

## Nowy workflow

build.ps1 tworzy sesję w systemowym Temp, buduje i testuje DEV oraz Notatnik, publikuje do świeżego katalogu, sprawdza uruchomienie i wykrycie modułów, a potem wymienia wyłącznie product/builds/Notarium. Poprzedni pakiet nie jest wymieniany przy błędzie testów lub weryfikacji. Przy błędzie przeniesienia przywracany jest poprzedni katalog. Sesja tymczasowa jest sprzątana.

Przed rozpoczęciem skrypt odmawia aktualizacji uruchomionego pakietu. Binaria, zależności, dist, cache i zrzuty testowe są wyłączone z Git. AGENTS.md utrwala te zasady. Informację o commicie użytym do budowania przechowuje build-info.json; późniejszy commit samego raportu nie zmienia kodu aplikacji.

## Sprawdzenie

- PASS: pełny build.ps1, kod wyjścia 0.
- PASS: 5 scenariuszy galerii webowej, 5 testów natywnego DEV, 4 grupy wspólnych komponentów edytora, 42 scenariusze edytora i 18 testów architektury Notatnika.
- PASS: świeży pakiet wykrywa dev i notebook, bez błędów i bez pozostawiania plików poprzednich wariantów.
- PASS: build-info.json wskazuje d73b733461666674bbbac0b7285154d7366d6daf.
- PASS: sesja Notarium-build-dd73a66cf8fa44499a7a93b5a76500a3 została usunięta po sukcesie.
- PASS: aplikacja uruchomiona z C:/NOTARIUM/product/builds/Notarium/Notarium.exe, panel zawiera pięć modułów. Pozostawiono otwartą; PID podczas sprawdzenia: 42108.
- PASS: powtórna próba budowania przy uruchomionej aplikacji została zatrzymana przed tworzeniem sesji. SHA-256 pliku wykonywalnego nie zmienił się.
- PASS: git merge-base potwierdza zachowanie historii cee55c8.

## Porządkowanie

Do systemowego Kosza, nie do releases, przeniesiono:

- 10 nieaktualnych wariantów z product/builds — wszystkie poza Notarium.
- 3 kopie źródeł do testów w product/environment.
- source/outputs/engines-check oraz product/operations/tests/editor.
- ZIP źródeł zachowany wcześniej w Git oraz dwa stare raporty JSON w product/operations.

Łącznie 15 katalogów i 3 pliki, 2113762113 bajtów. Można je odzyskać z Kosza. Nie usunięto źródeł, danych notatek ani historii Git. Aktualny build pozostaje w jednym katalogu; environment nie zawiera kopii wersji.
