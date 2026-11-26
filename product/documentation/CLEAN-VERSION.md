# Oczyszczona wersja Notarium

Gałąź: `codex/notarium-clean`, punkt wyjścia: `6092d0b` na `main`.

## Zachowane

Notatnik, biblioteka i wyszukiwanie notatek, ulubione, karty, import i zapis, automatyczny zapis, cofanie i ponawianie. Dotychczasowy prosty pasek formatowania: nagłówek, pogrubienie, kursywa, przekreślenie, wyrównanie, czcionka, interlinia, szerokość obszaru, kolory i podświetlenie. Listy numerowane, punktowane i zadań; kontenery i ich ustawienia dostępne przez UI; kod, komórki Python, linki, obrazy, tabele i LaTeX. Gesty zaznaczania słów, wierszy i treści kontenera pozostają.

## Usunięte z implementacji

- Wstążka oraz karty Układ, Wstawianie, Odwołania i Obiekty.
- Skład stron: rozmiar i orientacja, marginesy, kolor strony, paginacja, widok wielu stron, stopki i numery stron, dzielenie wyrazów oraz numeryczne wcięcia i odstępy akapitów.
- Ukryty tryb artykułu i jego odrębne style; specjalne gesty Tab/Shift+Tab formatujące akapity i numerację jak w Wordzie.
- Panele powiązane ze wstążką (boczny i górny), ich szkielety AI, komentarzy, odwołań i numeracji. Wzory LaTeX nadal mają zwykłe okno edycji.
- Moduł DEV tools/tests oraz pozycje Kalendarz, Kolekcje i Prompting. Katalog modułów ładuje tylko Notatnik, również gdy obok pozostały stare pliki innych modułów.
- Konto i Ustawienia z panelu biblioteki oraz Help z menu startowego i Notatnika.

Usunięto kod poleceń, style, źródła modułów i testy właściwe wycofanym funkcjom. Szerokość prostego obszaru nadal zapisuje się w dokumencie; nie wymaga już trybu artykułu.

## Dane i wersje

Ta gałąź nie przenosi ani nie usuwa plików notatek użytkownika. Otwarcie starego dokumentu nie zapisuje go automatycznie. Przy kolejnej edycji zachowywana jest treść i obsługiwane formatowanie; wycofane ustawienia stron i akapitów nie należą do nowego schematu. Kopia kodu ze wszystkimi poprzednimi funkcjami pozostaje w historii `main`.

Aktualny program w `product/builds/Notarium` wymienia wyłącznie `build.ps1`, po pełnym sukcesie kontroli i przy zamkniętej aplikacji. Stan kodu gałęzi i uruchomiona wcześniej kompilacja to osobne rzeczy.

## Weryfikacja tej zmiany

Kompilacja powłoki i testów: bez błędów. Testy architektury i natywnych gestów: 49 kontroli zaliczonych. Test komponentów webowych: 5 kontroli zaliczonych. `clean-scope-test.mjs`: zachowanie treści starszego dokumentu, brak efektu wycofanych poleceń i zachowane proste formatowanie — zaliczone.

Pierwszą kompilację blokował test kliknięcia LaTeX: automatycznie wybrany punkt trafiał w krawędź kontenera. Poprawka `24b509f` kieruje rzeczywiste kliknięcie w środek widocznego wzoru; test edycji, walidacji i zapisu LaTeX przechodzi.

## Porządkowanie kodu

Podnoszenie kontenerów zachowuje szerokość obszaru: `scrollbar-gutter: stable` zapobiega przesunięciom elastycznych kolumn i wyśrodkowanych kontenerów, gdy podgląd przeciągania wywołuje paski przewijania. `drag-layout-test.mjs` sprawdza geometrię z rzeczywistymi paskami (domyślnie ukrywanymi przez Playwright).

Wydzielono model, widok, geometrię, zaznaczanie, hover i integrację kontenerów. `containers.js` zachowuje publiczny interfejs dla dotychczasowych użytkowników. Gesty tekstowe, stan wielokrotnego zaznaczania, polecenia i odczyt dokumentu mają osobne moduły. Właściciele obsługi zdarzeń usuwają swoje nasłuchiwanie przy zamknięciu edytora.

Usunięto nieużywany edytor `Legacy/` (9 plików), pozostawiając import starszych notatek Markdown. CSS sformatowano z zachowaniem kolejności reguł; reguł nie scalano w sposób zmieniający kaskadę. Poprawiono dokumentację i listę plików testów, aby pozostałości `obj` usuniętego DEV nie trafiały do kompilacji.
