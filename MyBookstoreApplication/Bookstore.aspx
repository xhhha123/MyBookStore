<%@ Page Title="Home Page" Language="C#" MasterPageFile="~/Site.master" AutoEventWireup="true"
    CodeBehind="Bookstore.aspx.cs" Inherits="MyBookstoreApplication._Bookstore" %>

<asp:Content ID="HeaderContent" runat="server" ContentPlaceHolderID="HeadContent">
</asp:Content>
<asp:Content ID="BodyContent" runat="server" ContentPlaceHolderID="MainContent">
    <h2>
        Bookstore
    </h2>  
    <p>
        <asp:ScriptManager ID="ScriptManager1" runat="server">
        </asp:ScriptManager>
        <asp:UpdatePanel runat="server"  UpdateMode="Conditional">
            <ContentTemplate>
                <asp:ListView ID="booksList" runat="server">
                    <ItemTemplate>
                        <div class="book">
                        <a href=<%# (Eval("shareId") != DBNull.Value && Eval("xodState").Equals("Ready") ? "http://api.pdftron.com/v2/view/" + Eval("shareId") + " target='_new'" : "#" )%>>
                            <%# Eval("shareId") != DBNull.Value && Eval("thumbnailState").Equals("Ready") ? "<img src='http://api.pdftron.com/v2/download/" + Eval("shareId") + "?type=thumbnail'>" : "" %>
                            <%# Eval("shareId") != DBNull.Value && Eval("thumbnailState").Equals("Queued") ? "<img src='Styles/ajax-loader-large.gif'>" : ""%>
                            <%# Eval("shareId") != DBNull.Value && Eval("thumbnailState").Equals("Error") ? "<img src='Styles/error.png'>" : ""%>
                            <%--<img src="<%# (Eval("shareId") != DBNull.Value && Eval("thumbnailState").equals("Ready") ? "http://api.pdftron.com/v2/download/" + Eval("shareId") + "?type=thumbnail" : "Styles/ajax-loader-large.gif")%>"/>--%>
                        </a>
                        
                        <div class="bookname"><%#  Server.HtmlEncode(Eval("name", "{0}"))%></div>
                        </div>
                    </ItemTemplate>
                    <EmptyDataTemplate>
                        <div style="text-align:center; background: #bfcbd6">There are no more books on this page.</div>
                    </EmptyDataTemplate>
                </asp:ListView>
                <asp:Timer runat="server" id="UpdateTimer" interval="500000" ontick="UpdateTimer_Tick" />
            </ContentTemplate>
        </asp:UpdatePanel>
    </p>
    <div style="text-align: center; margin: 5px; clear:both ">
        <asp:LinkButton ID="PrevLinkButton" runat="server" OnClick="PrevLinkButton_Click">&lt;&lt;Prev</asp:LinkButton>
        <%= " (Page " + this.getPageInQueryString()  + ") " %>
        <asp:LinkButton ID="NextLinkButton" runat="server" OnClick="NextLinkButton_Click">Next&gt;&gt;</asp:LinkButton>
    </div>
</asp:Content>
