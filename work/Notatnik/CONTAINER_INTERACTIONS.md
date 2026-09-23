# Zasady interakcji kontenerów

Kontener jest elementem dokumentu. Jego położenie, rozmiar, treść i kolejność powinny dać się przewidzieć przed rozpoczęciem gestu oraz po ponownym otwarciu notatki.

## Zaznaczenie i przenoszenie

- Kliknięcie obwódki zaznacza kontener od razu. Kliknięcie bez ruchu nie zmienia jego geometrii.
- Przeciąganie rozpoczyna się dopiero po przekroczeniu progu ruchu. Użytkownik widzi podniesiony kontener i miejsce upuszczenia.
- Upuszczenie wstawia kontener dokładnie tam, gdzie wskazuje znacznik: przed, za, obok albo wewnątrz grupy. Upuszczenie daleko poza edytorem nie zmienia dokumentu.
- Escape, przerwanie wskaźnika, utrata fokusu i zmiana notatki anulują niedokończony gest. Anulowanie przywraca obraz dokumentu sprzed gestu.
- Obraz, wzór i pozostałe kontenery korzystają z tych samych zasad przenoszenia.

## Szerokość i pozycja

- Prawa krawędź przesuwa się przy nieruchomej lewej; lewa przy nieruchomej prawej.
- Przesunięcie pojedynczej krawędzi nie zmienia widocznej pozycji ani szerokości sąsiadów. Kontener zatrzymuje się przed sąsiadem lub granicą edytora i nie może być węższy od swojej minimalnej szerokości.
- Separator między sąsiadami zmienia tylko te dwa kontenery. Ich zewnętrzne krawędzie pozostają nieruchome. Gdy suma minimalnych szerokości przekracza dostępne miejsce, separator nie wykonuje zmiany.
- Standardowa przerwa ma jedną pionową linię. Gdy pojedyncza krawędź odsuwa się od sąsiada, dotychczasowa linia pozostaje przy nieruchomym kontenerze, a druga pojawia się przy odsuwanej krawędzi. Obie granice są widoczne także po zapisaniu i ponownym otwarciu.
- Pojedyncze kliknięcie pionowego separatora wyrównuje szerokości dwóch sąsiadów w ich dotychczasowym łącznym obszarze, z zachowaniem obu zewnętrznych krawędzi i minimalnych szerokości.
- Podgląd podczas gestu ma odpowiadać wynikowi po puszczeniu myszy. Jeden zakończony gest powinien dać się cofnąć jednym poleceniem.
- Przy węższym oknie zapisane kolumny zachowują swoje wymiary i nie nakładają się na siebie; użytkownik może przewinąć szerszy układ.

## Wysokość i treść

- Dolna krawędź zmienia tylko wysokość. Dwuklik dopasowuje dolną krawędź do najbliższego sąsiada w tym samym wierszu; narożnik odnosi się do sąsiada po swojej stronie.
- Pole kodu i jego kontener zmieniają wysokość razem. Jeśli ukrywanie treści jest wyłączone, dopisanie kolejnych wierszy powiększa widoczną komórkę ponad zapisaną wysokość minimalną.
- Uchwyty i dolny pasek nie mogą zasłaniać treści ani własnych narożników. Wąski pasek przewija swoje przyciski w obrębie kontenera.

## Struktura dokumentu

- Dodanie nowego kontenera z paska kontenera w kolumnie umieszcza go pod całym wierszem.
- Usunięcie lub wyciągnięcie jednej z dwóch kolumn rozwiązuje jednoelementowy wiersz. Ocalały kontener traci przesunięcie właściwe tylko dla dawnego wiersza.
- Przyciski góra i dół działają w aktualnej grupie rodzeństwa. Kopiowanie i wklejanie kontenera korzysta z aktualnej zawartości schowka.
- Pozioma linia oznacza granicę między kontenerami ustawionymi jeden pod drugim; pionowa oznacza granicę wiersza kolumn. Kliknięcie linii wskazuje miejsce dla następnego wklejenia skopiowanego kontenera. Kliknięcie poza linią usuwa to wskazanie.
- Samo kliknięcie linii nie zmienia struktury dokumentu. Pierwszy wpisany znak tworzy na wskazanej granicy kontener tekstowy i umieszcza w nim dalszy tekst; działa to na obu pionowych liniach wokół pustej przerwy oraz na linii poziomej.
- Kliknięcie poniżej ostatniego kontenera pozwala pisać w nowym kontenerze tekstowym. Jeżeli ostatni kontener tekstowy jest już pusty, używany jest on zamiast tworzenia kolejnego.
- Wklejenie na linii poziomej tworzy rodzeństwo między dwoma blokami, również w grupie. Wklejenie na linii pionowej wstawia kolumnę między wskazanych sąsiadów i rozkłada szerokości wiersza na nowo. Wklejenie obcego tekstu nie używa zapamiętanego kontenera.
- Kolejność, atrybuty i geometria muszą przetrwać cofnięcie, ponowienie oraz otwarcie JSON i Markdown.

Te reguły są kontraktem dla kolejnych zmian. Nowy gest należy sprawdzać także przy sąsiadach, zagnieżdżeniu, zmianie okna i przerwaniu operacji.
