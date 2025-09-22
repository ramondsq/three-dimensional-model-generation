# API调用优化策略

## 5. 减少第三方API调用次数的策略

### 5.1 优化思路分析

#### 5.1.1 缓存策略 (Caching Strategy)
**基本思路：** 将已生成的模型结果存储起来，避免重复生成相同或相似的内容。

**优势：**
- 显著降低API调用成本
- 提升响应速度
- 减少服务依赖

**挑战：**
- 存储成本增加
- 缓存命中率优化
- 数据一致性维护

#### 5.1.2 相似度检测与复用 (Similarity Detection & Reuse)
**基本思路：** 检测用户输入与历史请求的相似度，复用相似结果。

**优势：**
- 智能化程度高
- 用户体验好
- 成本效益显著

**挑战：**
- 相似度算法复杂
- 计算开销较大
- 准确性要求高

#### 5.1.3 批量处理 (Batch Processing)
**基本思路：** 将多个请求合并为批量请求，利用API的批量优惠政策。

**优势：**
- 降低单次调用成本
- 提高API利用率
- 减少网络开销

**挑战：**
- 增加响应延迟
- 复杂度提升
- 错误处理困难

#### 5.1.4 预生成模型库 (Pre-generated Model Library)
**基本思路：** 预先生成常见物品的3D模型，构建本地模型库。

**优势：**
- 极快的响应速度
- 零API调用成本
- 高度可控

**挑战：**
- 前期投入巨大
- 覆盖范围有限
- 更新维护困难

#### 5.1.5 渐进式生成 (Progressive Generation)
**基本思路：** 先生成低质量版本快速展示，用户确认后再生成高质量版本。

**优势：**
- 减少无效生成
- 改善用户体验
- 降低平均成本

**挑战：**
- 实现逻辑复杂
- 需要多层级API支持
- 用户交互设计挑战

### 5.2 落地方案：智能缓存系统

基于分析，我选择**智能缓存系统**作为主要落地方案，结合**相似度检测**技术。

#### 5.2.1 系统架构设计

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   用户输入       │    │  相似度检测器    │    │   缓存数据库     │
│                │    │                │    │                │
│ - 文本描述      │────▶│ - 语义分析      │────▶│ - 文本索引      │
│ - 参考图片      │    │ - 图像特征提取   │    │ - 图像特征      │
│ - 生成参数      │    │ - 相似度计算     │    │ - 3D模型文件    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   缓存管理器     │              │
         │              │                │              │
         └──────────────▶│ - 命中判断      │◀─────────────┘
                        │ - 结果返回      │
                        │ - 缓存更新      │
                        └─────────────────┘
                               │
                ┌─────────────────────────────────┐
                │                                │
                ▼                                ▼
     ┌─────────────────┐              ┌─────────────────┐
     │   3D API调用     │              │   结果返回       │
     │                │              │                │
     │ - 新模型生成     │              │ - 缓存模型      │
     │ - 结果缓存       │              │ - 新生成模型     │
     └─────────────────┘              └─────────────────┘
```

#### 5.2.2 核心算法实现

1. **文本相似度检测算法**
```python
import sentence_transformers
import faiss
import numpy as np

class TextSimilarityDetector:
    def __init__(self):
        self.model = sentence_transformers.SentenceTransformer('all-MiniLM-L6-v2')
        self.index = faiss.IndexFlatIP(384)  # 384维向量索引
        self.text_cache = {}
        
    def encode_text(self, text):
        """将文本编码为向量"""
        return self.model.encode([text])[0]
    
    def find_similar(self, query_text, threshold=0.85):
        """查找相似文本"""
        query_vector = self.encode_text(query_text)
        query_vector = query_vector.reshape(1, -1)
        
        # 搜索最相似的向量
        similarities, indices = self.index.search(query_vector, 5)
        
        # 筛选超过阈值的结果
        similar_results = []
        for sim, idx in zip(similarities[0], indices[0]):
            if sim >= threshold:
                similar_results.append({
                    'similarity': sim,
                    'index': idx,
                    'cached_result': self.get_cached_result(idx)
                })
        
        return similar_results
    
    def add_to_cache(self, text, model_result):
        """添加到缓存"""
        vector = self.encode_text(text)
        vector = vector.reshape(1, -1)
        
        # 添加到向量索引
        idx = self.index.ntotal
        self.index.add(vector)
        
        # 存储文本和结果的映射
        self.text_cache[idx] = {
            'text': text,
            'model_result': model_result,
            'timestamp': time.time()
        }
```

2. **图像相似度检测算法**
```python
import cv2
import numpy as np
from sklearn.cluster import KMeans

class ImageSimilarityDetector:
    def __init__(self):
        self.feature_cache = {}
        
    def extract_features(self, image_path):
        """提取图像特征"""
        img = cv2.imread(image_path)
        
        # 颜色直方图特征
        hist_features = self.extract_color_histogram(img)
        
        # SIFT特征点
        sift_features = self.extract_sift_features(img)
        
        # 组合特征
        combined_features = np.concatenate([hist_features, sift_features])
        
        return combined_features
    
    def extract_color_histogram(self, img):
        """提取颜色直方图特征"""
        # 转换到HSV色彩空间
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        
        # 计算直方图
        hist = cv2.calcHist([hsv], [0, 1, 2], None, [50, 60, 60], [0, 180, 0, 256, 0, 256])
        
        # 归一化
        hist = cv2.normalize(hist, hist).flatten()
        
        return hist
    
    def extract_sift_features(self, img):
        """提取SIFT特征"""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        sift = cv2.SIFT_create()
        
        keypoints, descriptors = sift.detectAndCompute(gray, None)
        
        if descriptors is not None:
            # 使用K-means聚类生成固定长度特征
            kmeans = KMeans(n_clusters=50, random_state=42)
            kmeans.fit(descriptors)
            features = kmeans.cluster_centers_.flatten()
        else:
            features = np.zeros(50 * 128)  # 默认特征
            
        return features
    
    def calculate_similarity(self, features1, features2):
        """计算特征相似度"""
        # 使用余弦相似度
        dot_product = np.dot(features1, features2)
        norm1 = np.linalg.norm(features1)
        norm2 = np.linalg.norm(features2)
        
        similarity = dot_product / (norm1 * norm2)
        return similarity
```

#### 5.2.3 缓存策略设计

1. **多层级缓存**
   - L1缓存：精确匹配（相似度=1.0）
   - L2缓存：高相似度匹配（相似度>0.9）
   - L3缓存：中等相似度匹配（相似度>0.75）

2. **缓存淘汰策略**
   - LRU（最近最少使用）算法
   - 基于访问频率的权重调整
   - 定期清理过期数据

3. **存储优化**
   - 模型文件压缩存储
   - 分层存储架构（热数据SSD，冷数据HDD）
   - CDN分发加速

#### 5.2.4 性能优化

1. **异步处理**
   ```python
   import asyncio
   
   class AsyncCacheManager:
       async def get_or_generate(self, input_data):
           # 异步检查缓存
           cached_result = await self.check_cache_async(input_data)
           
           if cached_result:
               return cached_result
           
           # 异步调用API生成新模型
           new_result = await self.generate_model_async(input_data)
           
           # 异步更新缓存
           await self.update_cache_async(input_data, new_result)
           
           return new_result
   ```

2. **预加载策略**
   - 预测用户可能的请求
   - 后台预生成热门模型
   - 智能预加载缓存

### 5.3 预期效果

1. **成本节约**
   - 缓存命中率目标：65%+
   - API调用减少：60%+
   - 成本节约：50%+

2. **性能提升**
   - 平均响应时间：从120秒降低到15秒
   - 缓存命中响应时间：<2秒
   - 系统并发能力提升3倍

3. **用户体验**
   - 等待时间显著减少
   - 相似结果质量保证
   - 个性化推荐改善

这套智能缓存系统将成为我们降低API调用成本的核心武器，同时显著提升用户体验。