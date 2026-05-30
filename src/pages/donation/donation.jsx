import { useState } from 'react'
import './donation.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section id="header">
        <div>
          <h1>公立千歳科学技術大学-ルート検索サイト</h1>
          <p>公立千歳科学技術大学のルート検索サイトです。入力情報や出力結果は記録されていません。</p>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
      <section id="hero">
        <img src={heroImg} alt="Hero Image" />
      </section>
    </>
  )
}

export default App
