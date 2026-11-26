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

Pełny `test.mjs` zatrzymuje się na istniejącym wcześniej problemie: krawędź zaznaczania kontenera przechwytuje kliknięcie we wzór LaTeX. Nie oznaczamy pełnego zestawu ani bieżącego pakietu aplikacji jako zweryfikowanych; ta zmiana nie obejmuje naprawy tego problemu.
