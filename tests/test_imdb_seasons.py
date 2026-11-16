import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("seasons", Path(__file__).parents[1] / "scripts/imdb_seasons.py")
seasons = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seasons)


class SeasonTests(unittest.TestCase):
    def test_join_identity_equal_weight_and_missing_episodes(self):
        def ep(t, parent, season, number):
            return dict(tconst=t, parentTconst=parent, seasonNumber=season, episodeNumber=number)
        def rating(t, score, votes):
            return dict(tconst=t, averageRating=str(score), numVotes=str(votes))
        episodes = [ep("tt1", "tt100", "1", "1"), ep("tt2", "tt100", "1", "2"),
            ep("tt3", "tt100", "1", "3"), ep("tt4", "tt100", "0", "1"),
            ep("tt5", "tt999", "1", "1"), ep("tt6", "tt100", "2", "1"),
            ep("tt7", "tt100", "\\N", "1"), ep("tt1", "tt100", "1", "1")]
        ratings = [rating("tt1", 8, 10000), rating("tt2", 6, 10), rating("tt2", 6, 10),
            rating("tt4", 10, 500), rating("tt5", 10, 500), rating("tt6", 0, 0)]
        got = seasons.aggregate(episodes, ratings, {"tt100", "tt200"})
        self.assertEqual(got["tt100"], [{"SeasonNumber": 1, "Rating": 7, "RatedEpisodes": 2,
            "KnownEpisodes": 3, "MedianEpisodeVotes": 5005, "MinEpisodeVotes": 10}])
        self.assertEqual(got["tt200"], [])


if __name__ == "__main__":
    unittest.main()
