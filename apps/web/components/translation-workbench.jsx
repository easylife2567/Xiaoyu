import React from 'react'
import { EmptyState } from './workbench-shell.jsx'

export function TranslationWorkbenchBody() {
  return (
    <section className="workspace-grid translation-layout">
      <section className="console-section primary-workspace">
        <header>
          <h2>文件输入</h2>
          <span>仅支持 Excel</span>
        </header>
        <label className="upload-console">
          <strong>拖拽或点击上传</strong>
          <span>上传原始 Excel</span>
          <em>支持 .xlsx / .xls</em>
          <input aria-label="上传原始 Excel" accept=".xlsx,.xls" type="file" />
        </label>
      </section>

      <section className="console-section side-workspace">
        <header>
          <h2>运行设置</h2>
          <span>默认流程</span>
        </header>
        <button className="primary-button" disabled type="button">
          开始处理（能力待接入）
        </button>
        <dl className="compact-facts">
          <div>
            <dt>当前状态</dt>
            <dd>尚未开始</dd>
          </div>
          <div>
            <dt>文件要求</dt>
            <dd>Excel</dd>
          </div>
          <div>
            <dt>输出内容</dt>
            <dd>摘要 + 分类</dd>
          </div>
        </dl>
      </section>

      <EmptyState eyebrow="输入识别" title="等待文件上传" description="上传后将在这里展示系统已识别的文件信息。" />
      <EmptyState eyebrow="结果交付" title="等待处理完成" description="处理完成后，结果文件会出现在这里。" />
    </section>
  )
}
