# Przykładowe dokumenty A4

Pliki są w `product/source/Modules/Notebook/examples` i można je otworzyć przez **File → Open file…** w Notarium. Są to pliki Markdown z obsługiwanym przez aplikację nagłówkiem ustawień strony i rozszerzeniami HTML dla obiektów. Nie trzeba zmieniać ustawień A4 ręcznie. Obraz pokazu jest osadzony w pliku, bez zasobów sieciowych.

- `Notarium — pokaz funkcji A4.md`: pięć stron pokazu i ćwiczeń. Formatowanie tekstu, kolory, zakreślacz, czcionka, link, lokalne wcięcia/odstępy/interlinia, wyrównanie, listy zagnieżdżone, zadania, kontenery obok siebie z tytułami/stopkami/tłem, tabela, obraz z podpisem, wzory inline/blokowe, blok kodu i komórka Python. Niedostępne AI/komentarze/fragmenty oraz wykonywanie kodu są opisane jako ograniczenia, nie symulowane.
- `Praca licencjacka — edytor notatek — 5 stron A4.md`: strona tytułowa i cztery strony treści wraz z bibliografią, razem dokładnie pięć. Temat: projekt lokalnego edytora notatek o strukturze blokowej. Białe A4, Times New Roman, interlinia tekstu 1,25, wcięcie pierwszej linii 10 mm, marginesy góra/dół/prawo 20 mm, lewy 25 mm. Jest to skrócony przykład, nie gotowa praca uczelniana ani raport z przeprowadzonych badań. Dane personalne są polami do uzupełnienia. Bibliografia zawiera zweryfikowane dokumentacje techniczne.

Liczba stron jest zweryfikowana przy otwarciu i po eksporcie/ponownym imporcie w aktualnym edytorze, przy domyślnym powiększeniu. Zmiana treści, czcionki lub ustawień układu może zmienić liczbę stron. Aktualny tryb stronicowy pokazuje strony poziomo; przewijaj obszar dokumentu w prawo.

Z katalogu `product/source/Modules/Notebook/WebEditor` uruchom `node example-documents-test.mjs`. Test sprawdza A4, numerację, wymiary stron, rodzaje elementów, brak błędów JavaScript, zachowanie liczby stron po ponownym imporcie oraz dokładnie pięć stron pracy. Zapisuje obrazy stron i raport w systemowym Temp. Nie zmienia biblioteki użytkownika ani samych przykładów.
