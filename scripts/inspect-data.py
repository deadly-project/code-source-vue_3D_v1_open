#!/usr/bin/env python3
"""
Inspecte et affiche un diagnostic des données source géospatiales
(GPKG + TIFF) utilisées pour générer le modèle 3D.

Usage :
    python3 scripts/inspect-data.py
"""

import os
import sys

from osgeo import gdal, ogr, osr

SRC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "source-data")


def inspect_vector(fname, name):
    print(f"\n{'=' * 60}")
    print(f"=== {name.upper()} ({fname}) ===")
    print("=" * 60)
    path = os.path.join(SRC_DIR, fname)
    ds = gdal.OpenEx(path, gdal.OF_VECTOR)
    if not ds:
        print("  erreur d'ouverture")
        return
    for i in range(ds.GetLayerCount()):
        lyr = ds.GetLayer(i)
        srs = lyr.GetSpatialRef()
        srid = srs.GetAuthorityCode(None) if srs else "?"
        ext = lyr.GetExtent()
        print(f"  Couche : {lyr.GetName()}")
        print(f"  CRS    : EPSG:{srid}")
        print(f"  Type   : {lyr.GetGeomType()}")
        print(f"  Nobre  : {lyr.GetFeatureCount()}")
        print(
            f"  Bounds : minX={ext[0]:.4f} minY={ext[2]:.4f} "
            f"maxX={ext[1]:.4f} maxY={ext[3]:.4f}"
        )
        print(
            f"  Étendu : width={ext[1]-ext[0]:.3f} "
            f"height={ext[3]-ext[2]:.3f}"
        )
        print(f"  Colonnes : {[d.GetName() for d in lyr.schema]}")


def inspect_raster(fname, name):
    print(f"\n{'=' * 60}")
    print(f"=== {name.upper()} ({fname}) ===")
    print("=" * 60)
    path = os.path.join(SRC_DIR, fname)
    ds = gdal.Open(path)
    if not ds:
        print("  erreur d'ouverture")
        return
    gt = ds.GetGeoTransform()
    band = ds.GetRasterBand(1)
    print(f"  Taille     : {ds.RasterXSize} x {ds.RasterYSize}")
    print(f"  CRS        : {ds.GetProjection().split('[')[-1] if ds.GetProjection() else '?'}")
    print(f"  Geotransf  : {gt}")
    print(
        f"  Résolution : {abs(gt[1]):.4f} x {abs(gt[5]):.4f} (UTM m)"
    )
    print(
        f"  Emprise    : minX={gt[0]:.3f} maxX={gt[0]+gt[1]*ds.RasterXSize:.3f} "
        f"minY={gt[3]+gt[5]*ds.RasterYSize:.3f} maxY={gt[3]:.3f}"
    )
    std = band.ComputeStatistics(False)
    print(f"  Min/Max    : {std[0]} / {std[1]}")
    print(f"  Moyenne    : {std[2]:.2f}")
    print(f"  Écart-type : {std[3]:.2f}")
    print(f"  NoData     : {band.GetNoDataValue()}")


def main():
    print("=== DIAGNOSTIC DES DONNÉES SOURCE ===")
    print(f"Src : {SRC_DIR}")

    inspect_vector("buildingfinale.gpkg", "buildings")
    inspect_vector("highwayfinale.gpkg", "highways")
    inspect_vector("waterwayfinale.gpkg", "waterways")
    inspect_raster("fokotanyfinale.tif", "dem (fokotany)")
    print()


if __name__ == "__main__":
    main()
