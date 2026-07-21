# Photo shot list

Drop these files into `/public/images/` and the design completes itself —
no code changes needed. Until a file exists, a designed placeholder renders
in its place (navy gradient with the expected path printed on it).

| File | Used in | Suggested shot |
|---|---|---|
| `hero-building.jpg` | Home hero | Hospital facade / building exterior, landscape, ≥1920px wide |
| `doctor-1.jpg` … `doctor-8.jpg` | Doctor cards (home + directory) | Portrait or 3:4, doctor in scrubs/coat, dark or neutral background |
| `facility-equipment.jpg` | Facilities section | Operating theatre / diagnostic equipment, landscape |
| `facility-ward.jpg` | Reserved (gallery expansion) | Ward or reception interior |

Tips: keep every image under ~400 KB (use squoosh.app), JPG for photos.
When real photography is finalised, switch `SmartImage` to `next/image`
for automatic optimisation — it's a one-component change.
