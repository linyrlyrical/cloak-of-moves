import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from game_env import CloakEnv, RuleBasedAI, self_play_episode
from model import CloakNet, count_parameters

env = CloakEnv()
states = env.reset()
print("Env OK: map=%s, card=%s, scalar=%s" % (states[0]["map_features"].shape, states[0]["card_features"].shape, states[0]["scalar_features"].shape))

model = CloakNet()
total, trainable = count_parameters(model)
print("Model OK: %d params (%d trainable)" % (total, trainable))

episode_data = self_play_episode(env)
print("Self-play OK: %d players, %d steps" % (len(episode_data), len(episode_data[0])))