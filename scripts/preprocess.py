#!/usr/bin/env python3
"""
Prétraitement géospatial : GPKG/TIFF → données optimisées pour Three.js.

Convertit les données sources géospatiales (EPSG:32738 et EPSG:4326)
dans un repère local commun centré sur l'origine du projet QGIS 3D.

Repère local :
    localX = X_utm - originX
    localY = Y_utm - originY
    localZ = altitude (Z up)

Fichiers produits dans public/data/ :
    meta.json          - métadonnées / diagnostic du repère local
    terrain.json       - grille DEM (dimensions, emprise, tableau z)
    terrain.webp       - texture du terrain (copiée)
    buildings.json     - footprints bâtiments (reprojetés, repère local)
    highways.json      - lignes routes (reprojetées EPSG:4326 -> 32738)
    waterways.json     - lignes cours d'eau

Usage :
    python3 scripts/preprocess.py
"""

import json
import math
import os
import sys

import numpy as np
from osgeo import gdal, ogr, osr

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
PROJ_VERSION = "1.0.0"

SRC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "source-data")
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")

# Origine du repère local = origine du projet QGIS 3D (scene.json)
ORIGIN_X = 765510.1784336022
ORIGIN_Y = 7908299.210718792
ORIGIN_Z = 0.0

# Échelle verticale QGIS = 1.0
Z_SCALE = 1.0

# Bâtiments : aucune hauteur exploitable dans les attributs.
# On dérive une hauteur via un mapping cohérent (voir HAUTEURS_BUILDING).
DEFAULT_BUILDING_HEIGHT = 8.0
# ~3.0 m par niveau pour les bâtiments avec 'building:levels'
HEIGHT_PER_LEVEL = 3.0

# ---------------------------------------------------------------------------
# Reproj terrain (EPSG:32738 -> local)
# ---------------------------------------------------------------------------
def to_local(x, y, z=0.0):
    return (x - ORIGIN_X, y - ORIGIN_Y, z * Z_SCALE + ORIGIN_Z)


def convex_hull(xs, ys):
    """Enveloppe convexe (Andrew's monotone chain). Retourne la liste de
    sommets [x, y] (coordonnées locales) dans le sens antihoraire."""
    pts = sorted(zip(xs, ys))

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)

    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)

    return [[round(x, 3), round(y, 3)] for x, y in (lower[:-1] + upper[:-1])]


def build_terrain(meta):
    """Lit le DEM fokotanyfinale.tif et produit la grille locale."""
    print("=== DEM ===")
    src = os.path.join(SRC_DIR, "fokotanyfinale.tif")
    ds = gdal.Open(src)
    if not ds:
        raise RuntimeError(f"Impossible d'ouvrir {src}")

    band = ds.GetRasterBand(1)
    gt = ds.GetGeoTransform()
    cols = ds.RasterXSize
    rows = ds.RasterYSize
    nodata = band.GetNoDataValue()
    stats = band.ComputeStatistics(False)

    arr = band.ReadAsArray()

    # Emprise (EPSG:32738)
    minx = gt[0]
    maxy = gt[3]
    maxx = gt[0] + gt[1] * cols
    miny = gt[3] + gt[5] * rows
    px_w = gt[1]
    px_h = abs(gt[5])

    meta["dem"] = {
        "crs": "EPSG:32738",
        "size": [cols, rows],
        "resolution": [px_w, px_h],
        "bounds_utm": [minx, miny, maxx, maxy],
        "min": float(stats[0]),
        "max": float(stats[1]),
        "mean": float(stats[2]),
        "stddev": float(stats[3]),
        "nodata": nodata,
    }

    # Repère local
    origin_local = to_local(minx, maxy)
    local_west = minx - ORIGIN_X
    local_east = maxx - ORIGIN_X
    local_south = miny - ORIGIN_Y
    local_north = maxy - ORIGIN_Y

    print(
        f"  alloc={cols}x{rows}, res={px_w:.3f}x{px_h:.3f} "
        f"(EPSG:32738)"
    )
    print(f"  utm  minx={minx:.3f} miny={miny:.3f} maxx={maxx:.3f} maxy={maxy:.3f}")
    print(f"  local west={local_west:.3f} east={local_east:.3f} "
          f"south={local_south:.3f} north={local_north:.3f}")
    print(f"  min={stats[0]} max={stats[1]} mean={stats[2]:.2f} nodata={nodata}")

    # ---- Traitement NoData ----
    # Le DEM est à >68% NoData (0). Créer un trou dans le maillage n'est pas
    # acceptable visuellement. Stratégie : on remplace NoData par la valeur
    # moyenne des cellules valides voisines (interpolation de bord) pour
    # éviter les pics/trous artificiels.

    valid_mask = arr != nodata

    # Masque original de validité : sert d'alpha (1 = vrai relief, 0 = NoData).
    # On conserve l'original car valid_mask est ensuite modifié (remplissage).
    orig_valid_mask = valid_mask.copy()

    # Remplit les NoData internes avec la moyenne des 4 voisins valides
    # (itératif -- suffisant pour cette grille). Sinon moyenne globale.
    global_mean = float(arr[valid_mask].mean()) if valid_mask.any() else 1249.0
    arr_clean = arr.astype(float).copy()
    remaining = ~valid_mask
    for _ in range(50):
        if not remaining.any():
            break
        # indices des cellules encore invalides
        ri, ci = np.nonzero(remaining)
        changed = False
        new_fill = np.zeros_like(ri, dtype=float)
        mask_fill = np.zeros_like(ri, dtype=bool)
        for k in range(len(ri)):
            r, c = ri[k], ci[k]
            neigh = []
            for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nr, nc = r + dr, c + dc
                if 0 <= nr < rows and 0 <= nc < cols and valid_mask[nr, nc]:
                    neigh.append(arr[nr, nc])
            if neigh:
                new_fill[k] = sum(neigh) / len(neigh)
                mask_fill[k] = True
        # apply fill
        for k in range(len(ri)):
            if mask_fill[k]:
                arr_clean[ri[k], ci[k]] = new_fill[k]
                valid_mask[ri[k], ci[k]] = True
                remaining[ri[k], ci[k]] = False
                changed = True
        if not changed:
            break
    # NoData restants (isolés) -> moyenne globale
    remaining_rows, remaining_cols = np.nonzero(remaining)
    for r, c in zip(remaining_rows, remaining_cols):
        arr_clean[r, c] = global_mean

    # GDAL lit les lignes du nord (row 0 = maxy) vers le sud.
    # Le JS (createTerrainSampler / Terrain.jsx) suppose row 0 = sud (miny)
    # et stocke les hauteurs dans un tableau PLAT row-major :
    #   z[row * cols + col] avec row = (ly - miny) / sy.
    # On inverse donc les lignes et on aplatit en une liste de longueur rows*cols.
    #
    # On impose une valeur basse cohérente (base du relief) à TOUTES les
    # cellules NoData (masquées par l'alpha), pour que l'échantillonneur du
    # terrain (qui interpole sans tenir compte de l'alpha) ne produise jamais
    # d'altitude aberrante (0) au bord du fokotany.
    arr_clean = arr_clean.astype(float).copy()
    arr_clean[~orig_valid_mask] = global_mean
    z_values = arr_clean[::-1].ravel().tolist()

    # Alpha (validité réelle du relief) : 1 = donnée valide, 0 = NoData.
    # Même orientation que z (row 0 = sud) et tableau plat row-major.
    alpha_values = orig_valid_mask[::-1].ravel().astype(int).tolist()

    # ---- Polygone du fokotany ----
    # Le "fokotany" est la zone couverte par le relief valide (alpha = 1).
    # On construit son enveloppe convexe en coordonnées locales, afin que les
    # lignes (routes/eaux) puissent être réparties : dans le fokotany -> haut,
    # hors du fokotany -> bas.
    # Coordonnées locales des cellules valides (row 0 = sud, col 0 = ouest).
    valid_rows, valid_cols = np.nonzero(orig_valid_mask)
    if len(valid_rows) > 0:
        lx_pts = local_west + (valid_cols / max(cols - 1, 1)) * (maxx - minx)
        ly_pts = local_south + (valid_rows / max(rows - 1, 1)) * (maxy - miny)
        hull_pts = convex_hull(lx_pts.tolist(), ly_pts.tolist())
    else:
        hull_pts = []

    out = {
        "type": "terrain",
        "crs": "EPSG:32738",
        "origin": [ORIGIN_X, ORIGIN_Y, ORIGIN_Z],
        "zScale": Z_SCALE,
        "gridWidth": cols,
        "gridHeight": rows,
        "minx": local_west,
        "miny": local_south,
        "maxx": local_east,
        "maxy": local_north,
        "width": maxx - minx,
        "height": maxy - miny,
        "minElevation": float(stats[0]),
        "maxElevation": float(stats[1]),
        "z": z_values,
        "alpha": alpha_values,
        "fokotany": hull_pts,
        "textureUrl": "data/terrain.webp",
    }

    print(f"  ===> {os.path.join(OUT_DIR, 'terrain.json')}")
    return out


# ---------------------------------------------------------------------------
# Buildings
# ---------------------------------------------------------------------------
def build_buildings(meta):
    print("\n=== BUILDINGS ===")
    src = os.path.join(SRC_DIR, "buildingfinale.gpkg")

    driver = ogr.GetDriverByName("GPKG")
    ds = driver.Open(src, 0)
    lyr = ds.GetLayer()
    srs = lyr.GetSpatialRef()
    srid = srs.GetAuthorityCode(None)
    ext = lyr.GetExtent()

    meta["buildings"] = {
        "crs": f"EPSG:{srid}",
        "features": lyr.GetFeatureCount(),
        "geom": "MultiPolygon",
        "bounds_utm": list(ext),
    }
    print(f"  CRS: EPSG:{srid}")
    print(f"  Features: {lyr.GetFeatureCount()}")
    print(f"  Bounds: {list(ext)}")
    print(
        f"  width={ext[1]-ext[0]:.3f} height={ext[3]-ext[2]:.3f}"
    )

    # Reprojection si pas EPSG:32738
    target = osr.SpatialReference()
    target.ImportFromEPSG(32738)  # type: ignore
    ct = None
    if srid and int(srid) != 32738:
        ct = osr.CoordinateTransformation(srs, target)
        print(f"  Reprojection EPSG:{srid} -> EPSG:32738")

    # Collecte des hauteurs utiles
    heights_distinct = {}
    levels_distinct = {}

    buildings = []
    count_valid_heights = 0
    count_valid_levels = 0

    for feat in lyr:
        geom = feat.GetGeometryRef()
        if geom is None:
            continue
        props = feat.items()

        # Hauteur
        height = props.get("height")
        levels = props.get("building:levels")

        h = None
        if height is not None and str(height).strip() not in ("", "0"):
            try:
                h = float(height)
            except ValueError:
                h = None
        if h is not None and h > 0:
            count_valid_heights += 1
        elif levels is not None and str(levels).strip() not in ("", "0"):
            try:
                lv = float(levels)
                if lv > 0:
                    h = lv * HEIGHT_PER_LEVEL
                    count_valid_levels += 1
            except ValueError:
                pass
        if h is None or h <= 0:
            h = DEFAULT_BUILDING_HEIGHT

        # Récolte des attributs utiles
        attrs = {
            "osm_id": props.get("osm_id"),
            "name": props.get("name"),
            "building": props.get("building"),
            "amenity": props.get("amenity"),
            "building:levels": props.get("building:levels"),
            "height": props.get("height"),
            "addr:street": props.get("addr:street"),
            "addr:housenumber": props.get("addr:housenumber"),
            "addr:city": props.get("addr:city"),
            "shop": props.get("shop"),
            "office": props.get("office"),
            "tourism": props.get("tourism"),
            "religion": props.get("religion"),
            "opening_hours": props.get("opening_hours"),
        }

        # Trous/anneaux : Extraire le contour extérieur de chaque polygon
        rings = []
        if geom.GetGeometryName() in ("MULTIPOLYGON", "GEOMETRYCOLLECTION"):
            polys = [geom.GetGeometryRef(i) for i in range(geom.GetGeometryCount())]
        else:
            polys = [geom]

        for poly in polys:
            if poly is None:
                continue
            if poly.GetGeometryName() != "POLYGON":
                continue
            ext_ring = poly.GetGeometryRef(0)
            if ext_ring is None:
                continue
            ring_pts = []
            for j in range(ext_ring.GetPointCount()):
                x, y, z = ext_ring.GetPoint(j)
                # Reprojection
                if ct is not None:
                    pt = ogr.Geometry(ogr.wkbPoint)
                    pt.AddPoint(x, y)
                    pt.Transform(ct)
                    x, y = pt.GetX(), pt.GetY()
                lx, ly, _ = to_local(x, y)
                ring_pts.append([round(lx, 3), round(ly, 3)])
            # Supprime le dernier point s'il répète le premier (fermeture)
            if len(ring_pts) > 1 and ring_pts[0] == ring_pts[-1]:
                ring_pts.pop()
            if len(ring_pts) >= 3:
                rings.append(ring_pts)

        if not rings:
            continue

        # Centroïde local (pour info / sélection)
        cx = sum(p[0] for ring in rings for p in ring) / sum(
            len(ring) for ring in rings
        )
        cy = sum(p[1] for ring in rings for p in ring) / sum(
            len(ring) for ring in rings
        )

        buildings.append(
            {
                "id": f"b{len(buildings)}",
                "osm_id": attrs["osm_id"],
                "rings": rings,
                "height": h,
                "attrs": attrs,
                "centroid": [round(cx, 3), round(cy, 3)],
            }
        )

    print(
        f"  Hauteurs valides (attribut height): {count_valid_heights}"
    )
    print(f"  Hauteurs via building:levels: {count_valid_levels}")
    print(f"  Total bâtiments exportés: {len(buildings)}")

    out = {
        "type": "buildings",
        "crs": "EPSG:32738",
        "origin": [ORIGIN_X, ORIGIN_Y, ORIGIN_Z],
        "count": len(buildings),
        "defaultHeight": DEFAULT_BUILDING_HEIGHT,
        "heightPerLevel": HEIGHT_PER_LEVEL,
        "buildings": buildings,
    }

    print(f"  ===> {os.path.join(OUT_DIR, 'buildings.json')}")
    return out


# ---------------------------------------------------------------------------
# Lignes (routes, waterways) generiques
# ---------------------------------------------------------------------------
def build_lines(src, name, need_reproject, meta_key, meta):
    print(f"\n=== {name.upper()} ===")
    driver = ogr.GetDriverByName("GPKG")
    ds = driver.Open(src, 0)
    lyr = ds.GetLayer()
    srs = lyr.GetSpatialRef()
    srid = srs.GetAuthorityCode(None)
    ext = lyr.GetExtent()

    target = osr.SpatialReference()
    target.ImportFromEPSG(32738)  # type: ignore
    ct = None
    if need_reproject or (srid and int(srid) != 32738):
        ct = osr.CoordinateTransformation(srs, target)
        need_reproject = True

    meta[meta_key] = {
        "crs": f"EPSG:{srid}",
        "features": lyr.GetFeatureCount(),
        "geom": "LineString",
        "bounds_utm": list(ext),
    }
    print(f"  CRS: EPSG:{srid}" + (" (reprojeté -> EPSG:32738)" if need_reproject else ""))
    print(f"  Features: {lyr.GetFeatureCount()}")
    print(f"  Bounds: {list(ext)}")

    lines = []
    for feat in lyr:
        geom = feat.GetGeometryRef()
        if geom is None:
            continue
        props = feat.items()
        attrs = {
            k: props.get(k)
            for k in props.keys()
        }

        # Split multilinestring
        if geom.GetGeometryName() in ("MULTILINESTRING", "GEOMETRYCOLLECTION"):
            parts = [geom.GetGeometryRef(i) for i in range(geom.GetGeometryCount())]
        else:
            parts = [geom]

        for part in parts:
            if part is None or part.GetGeometryName() not in (
                "LINESTRING",
                "MULTILINESTRING",
            ):
                continue
            if part.GetGeometryName() == "MULTILINESTRING":
                subparts = [part.GetGeometryRef(i) for i in range(part.GetGeometryCount())]
            else:
                subparts = [part]
            for sub in subparts:
                if sub is None:
                    continue
                pts = []
                for j in range(sub.GetPointCount()):
                    x, y, z = sub.GetPoint(j)
                    if ct is not None:
                        pt = ogr.Geometry(ogr.wkbPoint)
                        pt.AddPoint(x, y)
                        pt.Transform(ct)
                        x, y = pt.GetX(), pt.GetY()
                    lx, ly, _ = to_local(x, y)
                    pts.append([round(lx, 3), round(ly, 3)])
                if len(pts) >= 2:
                    lines.append({"pts": pts, "attrs": attrs})

    print(f"  Lignes exportées: {len(lines)}")
    out = {
        "type": name,
        "crs": "EPSG:32738",
        "origin": [ORIGIN_X, ORIGIN_Y, ORIGIN_Z],
        "count": len(lines),
        "lines": lines,
    }
    dst = os.path.join(OUT_DIR, f"{name}.json")
    print(f"  ===> {dst}")
    return out


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(SRC_DIR, exist_ok=True)

    print(
        "=== PRETRAITEMENT GEOSPATIAL 3D ===\n"
        f"version {PROJ_VERSION}\n"
        f"Src : {SRC_DIR}\nOut : {OUT_DIR}\n"
    )
    print(f"Repère local : origine = ({ORIGIN_X}, {ORIGIN_Y}, {ORIGIN_Z})")
    print(f"zScale = {Z_SCALE}")

    meta = {
        "version": PROJ_VERSION,
        "crs": "EPSG:32738",
        "origin": [ORIGIN_X, ORIGIN_Y, ORIGIN_Z],
        "zScale": Z_SCALE,
    }

    # 1. Terrain
    terrain = build_terrain(meta)

    # 2. Bâtiments
    buildings = build_buildings(meta)

    # 3. Routes (reprojection EPSG:4326 -> EPSG:32738)
    highways = build_lines(
        os.path.join(SRC_DIR, "highwayfinale.gpkg"),
        "highways",
        need_reproject=True,
        meta_key="highways",
        meta=meta,
    )

    # 4. Waterways (EPSG:32738)
    waterways = build_lines(
        os.path.join(SRC_DIR, "waterwayfinale.gpkg"),
        "waterways",
        need_reproject=False,
        meta_key="waterways",
        meta=meta,
    )

    # ---- Repère local commun ----
    meta["local3d"] = {
        "originX": ORIGIN_X,
        "originY": ORIGIN_Y,
        "originZ": ORIGIN_Z,
        "zScale": Z_SCALE,
    }

    # ------------------------------------------------------------------
    # Écriture
    # ------------------------------------------------------------------
    with open(os.path.join(OUT_DIR, "terrain.json"), "w") as f:
        json.dump(terrain, f)
    with open(os.path.join(OUT_DIR, "buildings.json"), "w") as f:
        json.dump(buildings, f)
    with open(os.path.join(OUT_DIR, "highways.json"), "w") as f:
        json.dump(highways, f)
    with open(os.path.join(OUT_DIR, "waterways.json"), "w") as f:
        json.dump(waterways, f)

    # Copie la texture terrain (depuis source-data ou fallback)
    tex_src_candidates = [
        os.path.join(SRC_DIR, "terrain.webp"),
        os.path.join(OUT_DIR, "terrain.webp"),
    ]
    import shutil
    tex_found = False
    for cand in tex_src_candidates:
        if os.path.exists(cand):
            shutil.copy(cand, os.path.join(OUT_DIR, "terrain.webp"))
            tex_found = True
            print(f"\nTexture terrain copiée depuis {cand}")
            break
    if not tex_found:
        print("\nWARNING: texture terrain non trouvée; terrain non texturé.")

    with open(os.path.join(OUT_DIR, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    # ------------------------------------------------------------------
    # Diagnostic final
    # ------------------------------------------------------------------
    print("\n\n=== DIAGNOSTIC FINAL (REPERE LOCAL) ===")
    print("=== BUILDINGS ===")
    print(f"CRS: {meta['buildings']['crs']}")
    print(f"Features: {meta['buildings']['features']}")
    print(f"Bounds: {meta['buildings']['bounds_utm']}")

    print("\n=== HIGHWAYS ===")
    print(f"CRS: {meta['highways']['crs']} -> EPSG:32738")
    print(f"Features: {meta['highways']['features']}")
    print(f"Bounds: {meta['highways']['bounds_utm']}")

    print("\n=== WATERWAYS ===")
    print(f"CRS: {meta['waterways']['crs']}")
    print(f"Features: {meta['waterways']['features']}")
    print(f"Bounds: {meta['waterways']['bounds_utm']}")

    print("\n=== DEM ===")
    print(f"CRS: {meta['dem']['crs']}")
    print(f"Size: {meta['dem']['size']}")
    print(f"Resolution: {meta['dem']['resolution']}")
    print(f"Bounds: {meta['dem']['bounds_utm']}")
    print(f"Min: {meta['dem']['min']}")
    print(f"Max: {meta['dem']['max']}")
    print(f"NoData: {meta['dem']['nodata']}")

    print("\n=== LOCAL 3D ===")
    print(f"Origin X: {ORIGIN_X}")
    print(f"Origin Y: {ORIGIN_Y}")
    print(f"Width: {terrain['width']:.3f}")
    print(f"Height: {terrain['height']:.3f}")

    print("\nPrétraitement terminé avec succès.")


if __name__ == "__main__":
    main()
