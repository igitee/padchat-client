/*
 *    wxSocketMsgRouter.js is donated by wuchong 
 *    (chong.wu.xiangfan@gmail.com, github.com/iyjian)
 */

const x2j = require('xml2js')

let funcStack = []
let _ = require('lodash')

const messageTypeMapping = {
  // 1 文字消息
  text: 1,
  // 2 联系人推送
  contactPush: 2,
  // 3 图片消息
  image: 3,
  // 37 好友请求消息
  friendRequest: 37,
  // 49 APP消息(文件 或者 链接 H5)
  link: 49,
  // 2001 红包消息
  redPacket: 2001,
  // 2000 转账消息
  transfer: 2000
}

// xmlParse的同步方法

let parseXml = async (xml) => {
  return new Promise((resolve, reject) => {
    x2j.parseString(xml, {
      explicitArray: false
    }, (error, result) => {
      if (error) {
        reject(error)
      } else {
        resolve(result)
      }
    })
  })
}



module.exports = {
  handle: async (wxMsg, wx) => {
    // 消息类型
    let {mType} = wxMsg
    for (let o of funcStack) {
      // console.log('func---', o['fn'].toString())
      if (mType === o.mType && mType === messageTypeMapping.text) {
        let content = wxMsg.content.toString()
        if (o['mType'] === mType && o['regExp'].test(content)) {
          if (/@chatroom$/.test(wxMsg.fromUser)) {
            // 如果是群消息 把FromUser替换掉
            // 然后把Content中的FromUser截取出来
            // 然后把Content中的FromUser给替换掉
            wxMsg['groupId'] = wxMsg.fromUser
            wxMsg['fromUser'] = wxMsg.content.substr(0, wxMsg.content.indexOf(':\n'))
            wxMsg['content'] = wxMsg.content.substr(wxMsg.content.indexOf(':\n') + 2)
          }
          // 仅推送30秒之前的数据
          let {timestamp} = wxMsg
          if (timestamp * 1000 > +new Date() - 30 * 1000) {
            o['fn'](wxMsg, wx)
          }
          break
        }
      } else if (mType === o.mType && mType === messageTypeMapping.link) {
        if (wxMsg.content) {
          let originWxMsg = _.clone(wxMsg)
          // 图文消息要先编译一把Content中的xml
          if (/@chatroom$/.test(wxMsg.fromUser)) {
            // 如果是群消息，也是处理一把
            wxMsg['groupId'] = wxMsg.fromUser
            wxMsg['fromUser'] = wxMsg.content.substr(0, wxMsg.content.indexOf(':\n'))
            wxMsg['content'] = wxMsg.content.substr(wxMsg.content.indexOf(':\n') + 2)
          }
          //
          try {
            let xml = typeof wxMsg['content'] === 'object' ? wxMsg['content'] : await parseXml(wxMsg['content'])
            if (!xml) {
              console.log('messae missing element', xml, originWxMsg)
            }
            wxMsg['content'] = xml
            console.log('this link type is.....', xml.msg.appmsg.type)
            if (o['regExp'].test(xml.msg.appmsg.url) && xml.msg.appmsg.type == 5) {
              // 仅推送30秒之前的数据
              let {timestamp} = wxMsg
              if (timestamp * 1000 > +new Date() - 30 * 1000) {
                console.log('this link type is.....', xml.msg.appmsg.type)
                o['fn'](wxMsg, wx)
              }
              break
            }
          } catch (e) {
            console.log(e)
            console.log(originWxMsg)
          }
        } else {
          console.log('EMPTY MESSAGE: ', wxMsg)
          break
        }
      } else if (mType === o.mType && mType === messageTypeMapping.friendRequest) {
        // 好友请求是看他的好友请求备注
        // let Event = wxMsg.friendRequest
        if (wxMsg['content']) {
          let xml = await parseXml(wxMsg['content'])
          wxMsg['content'] = xml
          if (o['mType'] === mType && o['regExp'].test(xml.content)) {
            o['fn'](wxMsg, wx)
            break
          }
        }
      } else if (mType === o.mType && mType === messageTypeMapping.contactPush) {
        // 联系人信息的推送用联系人的UserName来匹配，虽然我不知道这是什么东西
        if (o['regExp'].test(wxMsg['userName'])) {
          o['fn'](wxMsg, wx)
        }
      }
    }
  },
  text: (regExp, fn) => {
    funcStack.push({
      mType: messageTypeMapping['text'],
      regExp,
      fn
    })
  },
  link: (regExp, fn) => {
    funcStack.push({
      mType: messageTypeMapping['link'],
      regExp,
      fn
    })
  },
  friendRequest: (regExp, fn) => {
    funcStack.push({
      mType: messageTypeMapping['friendRequest'],
      regExp,
      fn
    })
  },
  contactPush: (regExp, fn) => {
    funcStack.push({
      mType: messageTypeMapping['contactPush'],
      regExp,
      fn
    })
  }
}
