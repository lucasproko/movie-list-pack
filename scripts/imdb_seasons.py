#!/usr/bin/env python3
"""Import personal IMDb season averages without calling MDBList."""
import argparse
import csv
import datetime as dt
import gzip
import json
import os
from pathlib import Path
import re
import statistics
import time
import urllib.error
import urllib.request


def read_tsv(path):
    with gzip.open(path, "rt", encoding="utf-8", newline="") as stream:
        yield from csv.DictReader(stream, delimiter="\t")


def aggregate(episode_rows, rating_rows, series_ids):
    episodes = {}
    known = {}
    for row in episode_rows:
        series = row["parentTconst"]
        if series not in series_ids:
            continue
        season, number = row["seasonNumber"], row["episodeNumber"]
        if not season.isdigit() or int(season) < 1 or not number.isdigit() or int(number) < 1:
            continue
        episode = row["tconst"]
        if episode in episodes:
            continue
        episodes[episode] = (series, int(season))
        known[(series, int(season))] = known.get((series, int(season)), 0) + 1
    groups = {}
    seen = set()
    for row in rating_rows:
        episode = row["tconst"]
        if episode not in episodes or episode in seen:
            continue
        try:
            rating, votes = float(row["averageRating"]), int(row["numVotes"])
        except ValueError:
            continue
        if not 1 <= rating <= 10 or votes < 1:
            continue
        seen.add(episode)
        groups.setdefault(episodes[episode], []).append((rating, votes))
    result = {series: [] for series in series_ids}
    for (series, season), rated in sorted(groups.items()):
        result[series].append({
            "SeasonNumber": season,
            "Rating": sum(r for r, _ in rated) / len(rated),
            "RatedEpisodes": len(rated),
            "KnownEpisodes": known[(series, season)],
            "MedianEpisodeVotes": statistics.median(v for _, v in rated),
            "MinEpisodeVotes": min(v for _, v in rated),
        })
    return result


def download(cache, name):
    path = cache / name
    metadata = cache / (name + ".json")
    previous = json.loads(metadata.read_text()) if metadata.exists() else {}
    today = dt.datetime.now(dt.timezone.utc).date().isoformat()
    if path.exists() and previous.get("checkedDate") == today:
        return path, previous.get("lastModified")
    headers = {"User-Agent": "PersonalMovieList/1.0"}
    if path.exists() and previous.get("lastModified"):
        headers["If-Modified-Since"] = previous["lastModified"]
    request = urllib.request.Request("https://datasets.imdbws.com/" + name, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            temp = path.with_suffix(".download")
            with temp.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            # A truncated transfer must not replace a working cached file.
            with gzip.open(temp, "rb") as check:
                while check.read(1024 * 1024):
                    pass
            temp.replace(path)
            previous["lastModified"] = response.headers.get("Last-Modified")
    except urllib.error.HTTPError as error:
        if error.code != 304:
            raise RuntimeError(f"IMDb dataset download failed: HTTP {error.code}") from None
    previous["checkedDate"] = today
    metadata.write_text(json.dumps(previous))
    return path, previous.get("lastModified")


def coda(token, path, method="GET", body=None):
    encoded = json.dumps(body).encode() if body is not None else None
    for attempt in range(6):
        request = urllib.request.Request("https://coda.io/apis/v1/" + path, data=encoded,
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"}, method=method)
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 429 and attempt < 5:
                time.sleep(min(60, int(error.headers.get("Retry-After", "6"))))
                continue
            raise RuntimeError(f"Coda {method} failed: HTTP {error.code}") from None


def all_rows(token, base):
    result, path = [], base + "/rows?useColumnNames=true&limit=500"
    while path:
        response = coda(token, path)
        result.extend(response["items"])
        path = response.get("nextPageLink", "").removeprefix("https://coda.io/apis/v1/")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows-file", type=Path, help="Offline row export for preparation")
    parser.add_argument("--cache-dir", type=Path, default=Path.home() / "Library/Caches/MovieListIMDb")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--config", type=Path, help="Private doc, table, column IDs and token file")
    parser.add_argument("--sync", action="store_true", help="Write only the IMDb season-data column")
    args = parser.parse_args()
    config = json.loads(args.config.read_text()) if args.config else {}
    token = Path(config["tokenFile"]).read_text().strip() if args.sync else None
    base = f"docs/{config.get('docId')}/tables/{config.get('tableId')}"
    if args.rows_file:
        raw = json.loads(args.rows_file.read_text())
        rows = raw["rows"] if isinstance(raw, dict) else raw
    else:
        if not token:
            parser.error("Supply --rows-file or --sync with --config")
        rows = all_rows(token, base)
    id_column = config.get("idColumn", "IMDb season ID")
    valid = {}
    for row in rows:
        imdb_id = row.get("values", {}).get(id_column, row.get("imdbId", ""))
        if re.fullmatch(r"tt\d+", imdb_id or ""):
            valid[row["id"]] = imdb_id
    if not valid:
        raise RuntimeError("No current IMDb identities; existing scores were left unchanged")
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    ep_path, ep_date = download(args.cache_dir, "title.episode.tsv.gz")
    ratings_path, ratings_date = download(args.cache_dir, "title.ratings.tsv.gz")
    scores = aggregate(read_tsv(ep_path), read_tsv(ratings_path), set(valid.values()))
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    snapshots = {key: {"ImdbId": key, "Source": "IMDb episode averages", "UpdatedAt": now,
        "EpisodeDatasetModified": ep_date, "RatingsDatasetModified": ratings_date,
        "Seasons": value} for key, value in scores.items()}
    prepared = {"updatedAt": now, "rows": [{"id": row["id"], "name": row.get("name", ""),
        "imdbId": valid[row["id"]], "snapshot": snapshots[valid[row["id"]]]}
        for row in rows if row["id"] in valid]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(prepared, indent=2) + "\n")
    os.chmod(args.output, 0o600)
    changed = 0
    if args.sync:
        data_name = config.get("dataColumnName", "IMDb season data")
        for row in rows:
            imdb_id = valid.get(row["id"])
            if not imdb_id:
                continue
            snapshot = snapshots[imdb_id]
            old_json = row["values"].get(data_name, "")
            try:
                old = json.loads(old_json)
            except (ValueError, TypeError):
                old = {}
            # Keep unchanged snapshots stable, rather than recalculating every row daily.
            keys = ["ImdbId", "Source", "Seasons"]
            if all(old.get(k) == snapshot.get(k) for k in keys):
                continue
            # Recheck the live row identity immediately before writing by row ID.
            current = coda(token, base + "/rows/" + row["id"] + "?useColumnNames=true")
            if current["values"].get(id_column) != imdb_id:
                continue
            coda(token, base + "/rows/" + row["id"], "PUT", {"row": {"cells": [{
                "column": config["dataColumnId"], "value": json.dumps(snapshot, separators=(",", ":"))}]}})
            changed += 1
            time.sleep(0.7)
    print(json.dumps({"rows": len(prepared["rows"]), "ratedShows": sum(bool(s["Seasons"]) for s in snapshots.values()),
        "ratedSeasons": sum(len(s["Seasons"]) for s in snapshots.values()), "changedRows": changed,
        "mdblistRequests": 0, "output": str(args.output)}))


if __name__ == "__main__":
    main()
