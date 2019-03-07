<template>
  <div class="screenshot">
    <div id="screenshot"></div>
    <div class="resolution_ratio" ref="resolutionRatio">220x220</div>
    <div class="toolbar" ref="toolbar">
      <div class="toolbar-select">
        <div class="item" title="矩形工具" :class="{select:selectType==='rect'}" @click="operateTypeHandle('rect')"><i
          class="iconfont">&#xe790;</i>
        </div>
        <div class="item" title="椭圆工具" :class="{select:selectType==='ellipse'}" @click="operateTypeHandle('ellipse')"><i
          class="iconfont">&#xe791;</i></div>
        <div class="item" title="箭头工具" :class="{select:selectType==='arrow'}" @click="operateTypeHandle('arrow')"><i
          class="iconfont">&#xeb0b;</i></div>
        <div class="item" title="画刷工具" :class="{select:selectType==='doodle'}" @click="operateTypeHandle('doodle')"><i
          class="iconfont">&#xe661;</i></div>
        <div class="item" title="马赛克工具" :class="{select:selectType==='mosaic'}" @click="operateTypeHandle('mosaic')"><i
          class="iconfont">&#xe601;</i></div>
        <div class="item" title="文字工具" :class="{select:selectType==='text'}" @click="operateTypeHandle('text')"><i
          class="iconfont">&#xe600;</i>
        </div>
        <div class="separate"></div>
        <div class="item undo" title="撤销编辑" @click="undo"><i class="iconfont">&#xe639;</i></div>
        <div class="item save" title="保存" @click="saveImg"><i class="iconfont">&#xe878;</i></div>
        <div class="separate"></div>
        <div class="item cancel" title="退出截图" @click="close"><i class="iconfont">&#xe61e;</i></div>
        <div class="item finish" title="完成截图" @click="finish"><i class="iconfont">&#xe62d;</i><span>完成</span></div>
      </div>
      <div class="toolbar-set" v-if="selectType">
        <div class="font_size" v-if="selectType==='text'">
          <span class="text"><i class="iconfont">&#xe600;</i></span>
          <select :value="option[selectType].fontsize" @change="handleSelectChange">
            <option v-for="(item,index) in fontSizeList" :key="index" :value="item">{{item}}</option>
          </select>
        </div>
        <div class="thickness" v-else>
          <div class="thickness-item" :key="index" :class="{select:option[selectType].thickness===item}"
               @click="handleOptionChange('thickness',item)"
               v-for="(item,index) in thicknessList">
            <div :class="'item'+item"></div>
          </div>
        </div>
        <div class="ambiguity" v-if="selectType==='mosaic'">
          <span class="text">模糊度</span>
          <input type="range" :value="option[selectType].ambiguity" @change="handleInputChange">
        </div>
        <div class="color" v-else>
          <div class="curr-color" :style="{backgroundColor:option[selectType].currColor}"></div>
          <div class="color-list">
            <div class="color-item" :key="index" @click="handleOptionChange('currColor',color)"
                 :style="{backgroundColor:color}"
                 v-for="(color,index) in colorList"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="text-input" contenteditable="true" ref="textInput"></div>
  </div>
</template>

<script>
  const {screen} = require('electron')
  const Konva = require('konva')
  const moment = require('moment')
  const fs = require('fs')

  export default {
    name: 'screenshot',
    data () {
      return {
        option: {
          rect: {thickness: 1, currColor: '#000000'},
          ellipse: {thickness: 1, currColor: '#000000'},
          arrow: {thickness: 1, currColor: '#000000'},
          doodle: {thickness: 1, currColor: '#000000'},
          mosaic: {thickness: 1, ambiguity: 100},
          text: {fontsize: 14, currColor: '#000000'}
        },
        // 舞台
        stage: null,
        layer: null,
        // 当前操作类型
        operateType: 'clip',
        // 当前选中类型
        selectType: '',
        // 字体大小列表
        fontSizeList: [8, 9, 10, 11, 12, 14, 16, 18, 20, 22],
        thicknessList: [1, 2, 3],
        // 颜色列表
        colorList: ['#000000', '#808080', '#800101', '#f7883a', '#308430', '#385ad3', '#800180', '#019999', '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#99cc01', '#3894e4', '#f31bf3', '#16dcdc'],
        // 截图选区区域范围
        posRange: {x: {min: 0, max: 0}, y: {min: 0, max: 0}},
        // 编辑区域范围
        flagRange: {x: {min: 9999, max: 0}, y: {min: 9999, max: 0}},
        img: null
      }
    },
    created () {
      this.option = JSON.parse(localStorage.getItem('option')) || {
        rect: {thickness: 1, currColor: '#000000'},
        ellipse: {thickness: 1, currColor: '#000000'},
        arrow: {thickness: 1, currColor: '#000000'},
        doodle: {thickness: 1, currColor: '#000000'},
        mosaic: {thickness: 1, ambiguity: 100},
        text: {fontsize: 14, currColor: '#000000'}
      }
      this.$electron.ipcRenderer.on('screenshot', () => this.renderBgImg())
    },
    mounted () {
      let screenSize = {width: 0, height: 0}
      screen.getAllDisplays().map((display, index) => {
        screenSize.width = Math.max(screenSize.width, display.bounds.x + display.bounds.width)
        screenSize.height = Math.max(screenSize.height, display.bounds.y + display.bounds.height)
      })
      this.stage = new Konva.Stage({
        container: 'screenshot',
        width: screenSize.width,
        height: screenSize.height
      })
      this.layer = new Konva.Layer()
      this.stage.add(this.layer)
      this.addAtageEventListener()
    },
    methods: {
      close () {
        this.layer.destroyChildren()
        this.layer.draw()
        this.$electron.remote.getCurrentWindow().hide()
      },
      async renderBgImg () {
        let thumbnails = await new Promise((resolve, reject) => {
          this.$electron.desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: {width: 1920, height: 1080}
          }, (error, sources) => {
            if (error) throw error
            let thumbnails = sources.map((source, index) => {
              return source.thumbnail.toPNG().toString('base64')
            })
            resolve(thumbnails)
          })
        })
        let count = 0
        let displays = screen.getAllDisplays()
        displays.map((display, index) => {
          let img = new Image()
          img.src = `data:image/png;base64,${thumbnails[index]}`
          img.onload = ev => {
            let imgShape = new Konva.Image({
              x: display.bounds.x,
              y: display.bounds.y,
              name: 'bgImg',
              width: display.bounds.width,
              height: display.bounds.height,
              image: img
            })
            this.layer.add(imgShape).draw()
            count++
            if (count === displays.length) {
              this.$electron.remote.getCurrentWindow().show()
              this.clip()
            }
          }
        })
      },
      handleSelectChange (ev) {
        this.handleOptionChange('fontsize', Number(ev.target.value))
      },
      handleInputChange (ev) {
        this.handleOptionChange('ambiguity', Number(ev.target.value))
      },
      handleOptionChange (type, value) {
        this.option[this.selectType][type] = value
        localStorage.setItem('option', JSON.stringify(this.option))
      },
      refreshFlagRange ({x1, x2, y1, y2}) {
        this.flagRange.x.min = Math.min(this.flagRange.x.min, x1)
        this.flagRange.x.max = Math.max(this.flagRange.x.max, x2)
        this.flagRange.y.min = Math.min(this.flagRange.y.min, y1)
        this.flagRange.y.max = Math.max(this.flagRange.y.max, y2)
      },
      refreshPosRange ({x1, x2, y1, y2}) {
        this.posRange.x.min = x1
        this.posRange.x.max = x2
        this.posRange.y.min = y1
        this.posRange.y.max = y2
      },
      addAtageEventListener () {
        let isMousedown = false
        let x = 0
        let y = 0
        let shape = null

        this.stage.on('contentMousedown contentMousemove contentMouseup contentDblclick', evt => {
          switch (evt.type) {
            case 'contentDblclick':
              this.finish(null, !this.stage.findOne('#clipGroup'))
              break
            case 'contentMousedown':
              x = this.stage.getPointerPosition().x
              y = this.stage.getPointerPosition().y
              let clipGroup = this.stage.findOne('#clipGroup')
              if (evt.evt.button === 2) {
                if (x >= this.posRange.x.min && x <= this.posRange.x.max && y >= this.posRange.y.min && y <= this.posRange.y.max) {
                  // 右键菜单
                } else {
                  if (clipGroup) {
                    this.clip()
                  } else {
                    this.close()
                  }
                }
                return
              }
              if (this.operateType === 'clip') {
                isMousedown = true
              } else {
                if (x >= this.posRange.x.min && x <= this.posRange.x.max && y >= this.posRange.y.min && y <= this.posRange.y.max) {
                  isMousedown = true
                }
              }
              if (clipGroup) {
                if (clipGroup.draggable() && this.selectType) {
                  clipGroup.setAttrs({
                    draggable: false
                  })
                } else if (clipGroup.draggable()) {
                  this.operateType = ''
                }
              }
              break
            case 'contentMousemove':
              if (!isMousedown) break
              if (evt.evt.button !== 0) return
              let _x = this.stage.getPointerPosition().x
              let _y = this.stage.getPointerPosition().y

              if (this.operateType !== 'clip') {
                if (_x < this.posRange.x.min) {
                  _x = this.posRange.x.min
                } else if (_x > this.posRange.x.max) _x = this.posRange.x.max

                if (_y < this.posRange.y.min) {
                  _y = this.posRange.y.min
                } else if (_y > this.posRange.y.max) _y = this.posRange.y.max
              }

              let deltaX = _x - x
              let deltaY = _y - y
              let newX = x
              let newY = y

              if (!/arrow|doodle/.test(this.operateType)) {
                if (deltaX < 0) {
                  newX += deltaX
                  deltaX = Math.abs(deltaX)
                }
                if (deltaY < 0) {
                  newY += deltaY
                  deltaY = Math.abs(deltaY)
                }
              }

              if (this.operateType === 'clip') {
                this.drawClipMask({
                  x: newX,
                  y: newY,
                  width: deltaX,
                  height: deltaY
                })
                // 控制框
                this.drawClipGroup({x: newX, y: newY, width: deltaX, height: deltaY})
              } else if (this.operateType === 'rect') {
                if (!shape) {
                  shape = new Konva.Rect({
                    name: 'mark',
                    x: newX,
                    y: newY,
                    width: deltaX,
                    height: deltaY,
                    stroke: this.option[this.operateType].currColor,
                    strokeWidth: this.option[this.operateType].thickness
                  })
                  this.layer.add(shape)
                } else {
                  shape.setAttrs({
                    x: newX,
                    y: newY,
                    width: deltaX,
                    height: deltaY
                  })
                }
              } else if (this.operateType === 'ellipse') {
                if (!shape) {
                  shape = new Konva.Ellipse({
                    name: 'mark',
                    x: newX + deltaX / 2,
                    y: newY + deltaY / 2,
                    width: deltaX,
                    height: deltaY,
                    stroke: this.option[this.operateType].currColor,
                    strokeWidth: this.option[this.operateType].thickness
                  })
                  this.layer.add(shape)
                } else {
                  shape.setAttrs({
                    x: newX + deltaX / 2,
                    y: newY + deltaY / 2,
                    width: deltaX,
                    height: deltaY
                  })
                }
              } else if (this.operateType === 'arrow') {
                if (!shape) {
                  shape = new Konva.Arrow({
                    name: 'mark',
                    x: newX,
                    y: newY,
                    points: [0, 0, deltaX, deltaY],
                    fill: this.option[this.operateType].currColor,
                    stroke: this.option[this.operateType].currColor,
                    pointerLength: 15,
                    strokeWidth: this.option[this.operateType].thickness
                  })
                  this.layer.add(shape)
                } else {
                  shape.setAttrs({
                    points: [0, 0, deltaX, deltaY]
                  })
                }
              } else if (this.operateType === 'doodle') {
                if (!shape) {
                  shape = new Konva.Line({
                    name: 'mark',
                    x: newX,
                    y: newY,
                    points: [0, 0, deltaX, deltaY],
                    stroke: this.option[this.operateType].currColor,
                    strokeWidth: this.option[this.operateType].thickness
                  })
                  this.layer.add(shape)
                } else {
                  let points = shape.getAttr('points')
                  points.push(deltaX, deltaY)
                  shape.setAttrs({
                    points: points
                  })
                }
              } else if (this.operateType === 'text') {
                if (!shape) {
                  shape = new Konva.Rect({
                    x: newX,
                    y: newY,
                    width: deltaX,
                    height: deltaY,
                    dash: [10, 5],
                    stroke: '#000',
                    strokeWidth: 1
                  })
                  this.layer.add(shape)
                } else {
                  shape.setAttrs({
                    x: newX,
                    y: newY,
                    width: deltaX,
                    height: deltaY
                  })
                }
              }
              this.layer.draw()
              break
            case 'contentMouseup':
              if (evt.evt.button !== 0) return
              isMousedown = false
              this.showToolbar()
              if (this.operateType === 'clip') {
                let clipGroup = this.stage.findOne('#clipGroup')
                if (!clipGroup) return
                this.operateType = ''
              }
              if (!shape) return
              if (this.operateType === 'text') {
                let el = this.$refs.textInput

                let _w = shape.getWidth()
                let _h = shape.getHeight()

                let _x = shape.x()
                let _y = shape.y()

                el.style.left = _x + 'px'
                el.style.top = _y + 'px'
                el.style.width = _w + 'px'
                el.style.height = _h + 'px'
                el.style.visibility = 'visible'
                el.style.color = 'red'
                el.style.fontSize = `${this.option[this.operateType].fontsize}px`

                el.onblur = () => {
                  if (el.innerText) {
                    let textShape = new Konva.Text({
                      name: 'mark',
                      x: _x,
                      y: _y,
                      fontSize: this.option[this.operateType].fontsize,
                      width: _w,
                      height: _h,
                      text: el.innerText,
                      fill: this.option[this.operateType].currColor
                    })
                    this.layer.add(textShape).draw()
                    let rect = textShape.getClientRect()
                    this.refreshFlagRange({x1: rect.x, x2: rect.x + rect.width, y1: rect.y, y2: rect.y + rect.height})
                  }
                  el.onblur = null
                  el.innerText = ''
                  el.style.visibility = 'hidden'
                  shape.destroy()
                  shape = null
                  this.layer.draw()
                }
                el.focus()
              } else {
                let rect = shape.getClientRect()
                this.refreshFlagRange({x1: rect.x, x2: rect.x + rect.width, y1: rect.y, y2: rect.y + rect.height})
                shape = null
              }
              break
          }
        })
      },
      operateTypeHandle (type) {
        this.operateType = type
        if (this.selectType === type) {
          this.selectType = ''
        } else {
          this.selectType = type
        }
      },
      undo () {
        let all = this.layer.children
        let node = all[all.length - 1]
        if (!node.id()) {
          node.destroy()
          this.layer.draw()
        } else {
          this.clip()
        }
      },
      saveImg () {
        let res = this.$electron.remote.dialog.showSaveDialog(this.$electron.remote.getCurrentWindow(), {
          title: '另存为',
          defaultPath: `截图${moment().format('YYYYMMDDHHmmss')}.png`,
          filters: [
            {name: 'PNG', extensions: ['png']},
            {name: 'BMP', extensions: ['bmp']},
            {name: 'JPEG', extensions: ['jpg', 'jpeg']}
          ]
        })
        if (!res) return

        let clipGroup = this.stage.findOne('#clipGroup')

        let x = clipGroup.x()
        let y = clipGroup.y()
        let width = clipGroup.getWidth()
        let height = clipGroup.getHeight()

        let img = new Image()
        img.src = this.layer.toDataURL()
        img.onload = ev => {
          let imgShape = new Konva.Image({
            x: 0,
            y: 0,
            width: width,
            height: height,
            crop: {
              x: x,
              y: y,
              width: width,
              height: height
            },
            image: img
          })
          let imgData = imgShape.toDataURL()
          let base64Data = imgData.replace(/^data:image\/\w+;base64,/, '')
          let dataBuffer = Buffer.from(base64Data, 'base64')
          fs.writeFileSync(res, dataBuffer)
          this.close()
        }
      },
      finish (ev, isFullscreen) {
        console.log(isFullscreen)
        if (isFullscreen) {
          this.drawClipGroup({x: 0, y: 0, width: this.stage.getWidth(), height: this.stage.getHeight()})
          this.deleteClipMask()
        }

        let clipGroup = this.stage.findOne('#clipGroup')
        let x = clipGroup.x()
        let y = clipGroup.y()
        let width = clipGroup.getWidth()
        let height = clipGroup.getHeight()
        this.deleteClipGroup()
        let img = new Image()
        img.src = this.layer.toDataURL()
        img.onload = ev => {
          let imgShape = new Konva.Image({
            x: 0,
            y: 0,
            width: width,
            height: height,
            crop: {
              x: x,
              y: y,
              width: width,
              height: height
            },
            image: img
          })
          let imgData = imgShape.toDataURL()
          this.$electron.clipboard.writeImage(this.$electron.nativeImage.createFromDataURL(imgData))
          this.close()
        }
      },
      clearLayer () {
        this.layer.getChildren(node => node.name() !== 'bgImg').each(item => item.destroy())
        this.layer.draw()
      },
      clip () {
        this.hideToolbar()
        this.clearLayer()
        this.operateType = 'clip'
        this.selectType = ''
        this.$refs.resolutionRatio.style.visibility = 'hidden'

        let maskWidth = this.stage.getWidth()
        let maskHeight = this.stage.getHeight()

        let clipMask = new Konva.Path({
          id: 'clipMask',
          width: maskWidth,
          height: maskHeight,
          data: `m-${0},-${0}
                l0,${maskHeight}
                l${maskWidth},0
                l0,-${maskHeight}
                l-${maskWidth},0z`,
          fill: '#000',
          opacity: 0.5
        })
        clipMask.on('mousedown mousemove mouseup', evt => {
          switch (evt.type) {
            case 'mousedown':
              break
            case 'mousemove':
              break
            case 'mouseup':
              break
          }
        })
        this.layer.add(clipMask).draw()
      },
      drawClipGroup ({x, y, width, height}) {
        let clipGroup = this.stage.findOne('#clipGroup')
        let clipRect = this.stage.findOne('#clipRect')
        if (!clipGroup) {
          clipGroup = new Konva.Group({
            id: 'clipGroup',
            x: x,
            y: y,
            width: width,
            height: height,
            draggable: true,
            dragBoundFunc: pos => {
              if (this.operateType) {
                return {
                  x: clipGroup.x(),
                  y: clipGroup.y()
                }
              }
              let newY = pos.y
              if (newY < 0) {
                newY = 0
              } else if (newY > this.stage.getHeight() - clipGroup.getHeight()) newY = this.stage.getHeight() - clipGroup.getHeight()
              let newX = pos.x
              if (newX < 0) {
                newX = 0
              } else if (newX > this.stage.getWidth() - clipGroup.getWidth()) newX = this.stage.getWidth() - clipGroup.getWidth()
              this.showToolbar()
              this.drawClipMask({x: newX, y: newY, width: clipGroup.getWidth(), height: clipGroup.getHeight()})
              return {x: newX, y: newY}
            }
          })
          clipRect = new Konva.Rect({
            id: 'clipRect',
            x: 0,
            y: 0,
            width: width,
            height: height,
            strokeWidth: 1,
            stroke: '#00aaff'
          })
          this.drawAnchorPoints(clipGroup)
          clipGroup.add(clipRect)
          this.layer.add(clipGroup)
        } else {
          clipGroup.setAttrs({
            x: x,
            y: y,
            width: width,
            height: height
          })
          clipRect.setAttrs({
            width: width,
            height: height
          })
          this.refreshAllChildren(clipGroup)
        }
        this.layer.draw()
      },
      showToolbar () {
        let clipGroup = this.stage.findOne('#clipGroup')
        if (!clipGroup) return
        let x = clipGroup.x()
        let y = clipGroup.y()
        let width = clipGroup.getWidth()
        let height = clipGroup.getHeight()
        let toolbar = this.$refs.toolbar
        toolbar.style.left = x + width - toolbar.offsetWidth + 'px'
        toolbar.style.top = y + height + 5 + 'px'
        toolbar.style.visibility = 'visible'
      },
      hideToolbar () {
        let toolbar = this.$refs.toolbar
        toolbar.style.visibility = 'hidden'
      },
      refreshClipGroup () {
        let clipGroup = this.stage.findOne('#clipGroup')
        if (!clipGroup) return
        let x = clipGroup.x()
        let y = clipGroup.y()
        let width = clipGroup.getWidth()
        let height = clipGroup.getHeight()
        if (width < 0) {
          x += width
          width = -width
        }
        if (height < 0) {
          y += height
          height = -height
        }
        clipGroup.setAttrs({
          x: x,
          y: y,
          width: width,
          height: height
        })
        this.showToolbar()
        this.refreshAllChildren(clipGroup)
      },
      getAnchorPoints (parent) {
        /* eslint-disable camelcase */
        let p_w = parent.getWidth()
        let p_h = parent.getHeight()

        let pointList = []
        // 上面
        pointList.push({
          x: 0,
          y: 0,
          pos: 'top-left'
        })
        pointList.push({
          x: p_w / 2,
          y: 0,
          pos: 'top-center'
        })
        pointList.push({
          x: p_w,
          y: 0,
          pos: 'top-right'
        })
        // 中间
        pointList.push({
          x: 0,
          y: p_h / 2,
          pos: 'middle-left'
        })
        pointList.push({
          x: p_w,
          y: p_h / 2,
          pos: 'middle-right'
        })
        // 下面
        pointList.push({
          x: 0,
          y: p_h,
          pos: 'bottom-left'
        })
        pointList.push({
          x: p_w / 2,
          y: p_h,
          pos: 'bottom-center'
        })
        pointList.push({
          x: p_w,
          y: p_h,
          pos: 'bottom-right'
        })

        return pointList
      },
      drawAnchorPoints (parent) {
        let pointList = this.getAnchorPoints(parent)
        for (let i = 0; i < pointList.length; i++) {
          let point = pointList[i]
          let anchorPoint = new Konva.Circle({
            name: 'anchorPoint',
            x: point.x,
            y: point.y,
            radius: 5,
            fill: '#00aaff',
            draggable: true,
            pos: point.pos
          })
          parent.add(anchorPoint)
          if (anchorPoint.eventListeners.dragend) continue
          let startX, startY
          let startMX, startMY
          let startW, startH
          anchorPoint.on('dragstart dragmove dragend mouseover mouseout', evt => {
            if (evt.type === 'dragstart') {
              startMX = this.stage.getPointerPosition().x
              startMY = this.stage.getPointerPosition().y

              startX = parent.x()
              startY = parent.y()
              startW = parent.getWidth()
              startH = parent.getHeight()
              this.hideToolbar()
            } else if (evt.type === 'dragmove') {
              evt.cancelBubble = true
              let deltaX = this.stage.getPointerPosition().x - startMX
              let deltaY = this.stage.getPointerPosition().y - startMY

              if (point.pos === 'top-left') {
                if (this.flagRange.x.min < startX + deltaX) {
                  deltaX = this.flagRange.x.min - startX
                }
                if (this.flagRange.y.min < startY + deltaY) {
                  deltaY = this.flagRange.y.min - startY
                }
                parent.setAttrs({
                  x: startX + deltaX,
                  y: startY + deltaY,
                  width: startW - deltaX,
                  height: startH - deltaY
                })
              } else if (point.pos === 'top-center') {
                // if (this.flagRange.x.min < startX + deltaX) {
                //   deltaX = this.flagRange.x.min - startX
                // }
                if (this.flagRange.y.min < startY + deltaY) {
                  deltaY = this.flagRange.y.min - startY
                }
                parent.setAttrs({
                  x: startX,
                  y: startY + deltaY,
                  width: startW,
                  height: startH - deltaY
                })
              } else if (point.pos === 'top-right') {
                if (this.flagRange.x.max > startX + startW + deltaX) {
                  deltaX = this.flagRange.x.max - startX - startW
                }
                if (this.flagRange.y.min < startY + deltaY) {
                  deltaY = this.flagRange.y.min - startY
                }
                parent.setAttrs({
                  x: startX,
                  y: startY + deltaY,
                  width: startW + deltaX,
                  height: startH - deltaY
                })
              } else if (point.pos === 'middle-left') {
                if (this.flagRange.x.min < startX + deltaX) {
                  deltaX = this.flagRange.x.min - startX
                }
                // if (this.flagRange.y.min < startY + deltaY) {
                //   deltaY = this.flagRange.y.min - startY
                // }
                parent.setAttrs({
                  x: startX + deltaX,
                  y: startY,
                  width: startW - deltaX,
                  height: startH
                })
              } else if (point.pos === 'middle-right') {
                if (this.flagRange.x.max > startX + startW + deltaX) {
                  deltaX = this.flagRange.x.max - startX - startW
                }
                // if (this.flagRange.y.min < startY + deltaY) {
                //   deltaY = this.flagRange.y.min - startY
                // }
                parent.setAttrs({
                  x: startX,
                  y: startY,
                  width: startW + deltaX,
                  height: startH
                })
              } else if (point.pos === 'bottom-left') {
                if (this.flagRange.x.min < startX + deltaX) {
                  deltaX = this.flagRange.x.min - startX
                }
                if (this.flagRange.y.max > startY + startH + deltaY) {
                  deltaY = this.flagRange.y.max - startY - startH
                }
                parent.setAttrs({
                  x: startX + deltaX,
                  y: startY,
                  width: startW - deltaX,
                  height: startH + deltaY
                })
              } else if (point.pos === 'bottom-center') {
                // if (this.flagRange.x.min < startX + deltaX) {
                //   deltaX = this.flagRange.x.min - startX
                // }
                if (this.flagRange.y.max > startY + startH + deltaY) {
                  deltaY = this.flagRange.y.max - startY - startH
                }
                parent.setAttrs({
                  x: startX,
                  y: startY,
                  width: startW,
                  height: startH + deltaY
                })
              } else if (point.pos === 'bottom-right') {
                if (this.flagRange.x.max > startX + startW + deltaX) {
                  deltaX = this.flagRange.x.max - startX - startW
                }
                if (this.flagRange.y.max > startY + startH + deltaY) {
                  deltaY = this.flagRange.y.max - startY - startH
                }
                parent.setAttrs({
                  x: startX,
                  y: startY,
                  width: startW + deltaX,
                  height: startH + deltaY
                })
              }
              this.refreshAllChildren(parent)
            } else if (evt.type === 'dragend') {
              this.refreshClipGroup()
            } else if (evt.type === 'mouseover') {
              evt.cancelBubble = true

              if (point.pos === 'top-left') {
                document.body.style.cursor = 'se-resize'
              } else if (point.pos === 'top-center') {
                document.body.style.cursor = 'n-resize'
              } else if (point.pos === 'top-right') {
                document.body.style.cursor = 'sw-resize'
              } else if (point.pos === 'middle-left') {
                document.body.style.cursor = 'w-resize'
              } else if (point.pos === 'middle-center') {
                // document.body.style.cursor = "move";
              } else if (point.pos === 'middle-right') {
                document.body.style.cursor = 'w-resize'
              } else if (point.pos === 'bottom-left') {
                document.body.style.cursor = 'sw-resize'
              } else if (point.pos === 'bottom-center') {
                document.body.style.cursor = 'n-resize'
              } else if (point.pos === 'bottom-right') {
                document.body.style.cursor = 'se-resize'
              }
            } else if (evt.type === 'mouseout') {
              document.body.style.cursor = 'default'
            }
          })
        }
      },
      drawClipMask ({x, y, width, height}) {
        let clipMask = this.stage.findOne('#clipMask')
        if (!clipMask) return
        this.refreshPosRange({x1: x, x2: x + width, y1: y, y2: y + height})
        clipMask.setAttrs({
          data: `m${-0},${-0}
                l0,${clipMask.getHeight()}
                l${clipMask.getWidth()},0
                l0,-${clipMask.getHeight()}
                l-${clipMask.getWidth()},0z
                m${0},${0}
                m${x},${y}
                l${width},0
                l0,${height}
                l-${width},0
                l0,-${height}z`
        })
        let resolutionRatio = this.$refs.resolutionRatio
        resolutionRatio.style.left = x + 'px'
        resolutionRatio.style.top = y - resolutionRatio.offsetHeight + 'px'
        resolutionRatio.style.visibility = 'visible'
        resolutionRatio.innerHTML = `${width} x ${height}`
      },
      deleteClipMask () {
        let clipMask = this.stage.findOne('#clipMask')
        if (clipMask) clipMask.destroy()
        this.layer.draw()
      },
      deleteClipGroup () {
        let clipGroup = this.stage.findOne('#clipGroup')
        if (clipGroup) clipGroup.destroy()
        this.layer.draw()
      },
      refreshAllChildren (parent) {
        let p_w = parent.getWidth()
        let p_h = parent.getHeight()
        let p_x = parent.x()
        let p_y = parent.y()

        let pointList = this.getAnchorPoints(parent)

        let clipRect = this.stage.findOne('#clipRect')

        clipRect.setAttrs({
          width: p_w,
          height: p_h
        })

        let _p_x = p_x
        let _p_y = p_y
        let _p_w = p_w
        let _p_h = p_h

        if (p_w < 0) {
          _p_x += p_w
          _p_w = -_p_w
        }
        if (p_h < 0) {
          _p_y += p_h
          _p_h = -_p_h
        }
        this.drawClipMask({
          x: _p_x,
          y: _p_y,
          width: _p_w,
          height: _p_h
        })

        let anchorPoints = this.stage.find('.anchorPoint')

        anchorPoints.map(anchorPoint => {
          let point = pointList.find(item => item.pos === anchorPoint.getAttr('pos'))
          anchorPoint.setAttrs({
            x: point.x,
            y: point.y
          })
        })

        this.layer.draw()
      }
    }
  }
</script>

<style lang="scss">
  @import "./assets/css/common.css";

  html, body {
    margin: 0;
  }

  .screenshot {
    height: 100%;
    width: 100%;
    overflow: hidden;
    position: relative;

    #screenshot {
      height: 100%;
      width: 100%;
      overflow: hidden;
    }

    .resolution_ratio {
      font-family: Consolas;
      position: absolute;
      z-index: 999;
      background-color: #282828;
      color: white;
      padding: 2px 5px;
      font-size: 14px;
      user-select: none;
      visibility: hidden;
      top: 0;
      left: 0;
      pointer-events: none;
      border-radius: 3px;
    }

    .toolbar {
      position: absolute;
      z-index: 99999;
      box-sizing: border-box;
      cursor: default;
      top: 0;
      user-select: none;
      visibility: hidden;

      .toolbar-select {
        background-color: #e8ecf3;
        height: 30px;
        padding: 5px;
        overflow: hidden;
        border-radius: 3px;
        font-size: 13px;
        box-sizing: border-box;

        .item {
          display: inline-block;
          height: 100%;
          overflow: hidden;
          line-height: 20px;
          text-align: center;
          margin-left: 5px;
          box-sizing: border-box;
          padding: 0 2px;
          vertical-align: top;
          color: #3498e0;
          font-weight: bolder;

          &.undo {
            color: #67ae44;
          }

          &.save {
            color: #7391d6;
          }

          &.finish {
            color: #68af45;

            span {
              color: black;
              margin-left: 5px;
              vertical-align: top;
              display: inline-block;
              font-size: 12px;
            }
          }

          &.cancel {
            color: #e84736;
          }

          &:hover, &.select {
            box-shadow: 0 0 0 1px #666;
          }

          &:nth-child(1) {
            margin-left: 0;
          }
        }

        .separate {
          display: inline-block;
          width: 1px;
          background-color: #aaa;
          height: calc(100% - 6px);
          margin: 3px 0;
          vertical-align: top;
          margin-left: 5px;
          /*padding: 0 1px;*/
        }
      }

      .toolbar-set {
        display: inline-block;
        margin-top: 3px;
        height: 35px;
        background-color: #e8ecf3;
        padding: 5px;
        border-radius: 3px;
        box-sizing: border-box;

        .thickness {
          display: inline-block;
          padding: 2px;
          height: 100%;
          vertical-align: top;
          box-sizing: border-box;

          .thickness-item {
            display: inline-block;
            height: 100%;
            width: 20px;
            font-family: Consolas;
            vertical-align: top;
            color: #2f8ddd;
            position: relative;

            &:hover, &.select {
              box-shadow: 0 0 0 1px #666;
              border-radius: 2px;
              background-color: rgba(0, 0, 0, 0.1);
            }

            div {
              background-color: #2f8ddd;
              border-radius: 50%;
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              margin: auto;

              @for $i from 1 through 3 {
                &.item#{$i} {
                  width: calc(#{$i} * 2px + 2px);
                  height: calc(#{$i} * 2px + 2px);
                }
              }

            }
          }

        }

        .font_size {
          display: inline-block;
          padding: 2px;
          height: 100%;
          vertical-align: top;
          box-sizing: border-box;

          .text {
            color: #3498e0;
          }

          select {
            outline: none;
          }
        }

        .ambiguity {
          display: inline-block;
          height: 100%;

          .text {
            display: inline-block;
            font-size: 12px;
            vertical-align: top;
            line-height: 22px;
          }

          input[type=range] {

          }
        }

        .color {
          display: inline-block;
          height: 100%;

          .curr-color {
            display: inline-block;
            background-color: red;
            height: 100%;
            width: 25px;
            border: 2px solid #666;
            box-sizing: border-box;
          }

          .color-list {
            vertical-align: top;
            display: inline-block;
            width: 104px;
            height: 100%;
            font-size: 0;

            .color-item {
              display: inline-block;
              background-color: black;
              height: calc((100% - 4px) / 2);
              box-sizing: border-box;
              width: 11px;
              vertical-align: top;
              margin-left: 2px;
              margin-top: 2px;
              border: 1px solid #999;

              &:hover {
                border-color: black;
                border-width: 2px;
              }
            }
          }
        }
      }
    }

    .text-input {
      position: absolute;
      visibility: hidden;
      outline: none;
      cursor: auto !important;
    }
  }
</style>
