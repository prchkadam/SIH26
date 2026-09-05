from embeddings import embed_text

text1 = "A vehicle was stolen near a highway checkpoint at night."
text2 = "A car was taken near a border checkpoint during the night."
text3 = "A person reported a missing mobile phone from a college hostel."

v1 = embed_text(text1)
v2 = embed_text(text2)
v3 = embed_text(text3)

import numpy as np

similarity_12 = np.dot(v1, v2)
similarity_13 = np.dot(v1, v3)

print("Case 1 ↔ Case 2:", round(max(0, min(1, similarity_12)) * 100 ))
print("Case 1 ↔ Case 3:", round(max(0, min(1, similarity_13)) * 100))