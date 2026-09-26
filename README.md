# Notarium

Kanoniczne repozytorium: C:/NOTARIUM. Kod: product/source. Dokumentacja: product/documentation.

Historia kodu jest w Git, zachowana od dotychczasowego repozytorium Artllex/Notarium. Nie używamy katalogów final/verified ani kopii źródeł jako systemu wersjonowania.

- Aktualna aplikacja: product/builds/Notarium/Notarium.exe.
- Budowanie i testy: product/source/build.ps1.
- Wybrane wydania: product/releases, wyłącznie przy świadomym tworzeniu wydania.
- Tymczasowe warianty testowe: katalog systemowy Temp, sprzątany po sprawdzeniu.
- Opis architektury: [product/documentation/ARCHITECTURE.md](product/documentation/ARCHITECTURE.md).

Wszystkie zależności, binaria i wygenerowane zasoby są wyłączone z Git. Po zmianach wykonujemy logiczne commity; push jest oddzielną operacją.
