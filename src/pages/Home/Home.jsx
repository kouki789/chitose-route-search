import { useState } from 'react'
import './Home.css'

export default function Home() {
    const [direction, setDirection] = useState('outbound')
    const [inputValue, setInputValue] = useState('')

    return (
        <main>
            <section className="hero">
                <div className="container">
                    <div className="hero-content">
                        <div className="hero-badge">
                            公立千歳科学技術大学-ルート検索サイト</div>
                            <h1>公立千歳科学技術大学までの<br/>ルート検索サイトです。<br/>
                                入力情報や出力結果は記録されていません。</h1>
                        <p className="hero-desc">
                            ご希望の目的地を入力してください。
                        </p>

                        <div className="direction-toggle">
                            <button
                                className={`direction-btn ${direction === 'outbound' ? 'active' : ''}`}
                                onClick={() => { setDirection('outbound'); setInputValue('') }}
                            >
                                往路（行き）
                            </button>
                            <button
                                className={`direction-btn ${direction === 'return' ? 'active' : ''}`}
                                onClick={() => { setDirection('return'); setInputValue('') }}
                            >
                                復路（帰り）
                            </button>
                        </div>

                        <div className="route-input-wrap">
                            <label className="route-label">
                                {direction === 'outbound' ? '出発地を入力' : '目的地を入力'}
                            </label>
                            <input
                                className="route-input"
                                type="text"
                                placeholder={direction === 'outbound' ? '例: 札幌駅' : '例: 自宅'}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                            />
                        </div>

                    </div>
                </div>
           </section>
        </main>
    )
}